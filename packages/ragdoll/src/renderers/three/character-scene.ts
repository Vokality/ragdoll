import {
  ACESFilmicToneMapping,
  AmbientLight,
  AlwaysStencilFunc,
  BufferGeometry,
  Color,
  DirectionalLight,
  EqualStencilFunc,
  ExtrudeGeometry,
  Group,
  HemisphereLight,
  KeepStencilOp,
  Line,
  Mesh,
  MeshStandardMaterial,
  PCFSoftShadowMap,
  PerspectiveCamera,
  PlaneGeometry,
  ReplaceStencilOp,
  Scene,
  SphereGeometry,
  Vector3,
  WebGLRenderer,
  type Material,
} from "three";
import type { RenderData } from "../../components/render-data";
import { svgPathToShape } from "./svg-path-shape";
import {
  applyThemeToMaterials,
  createThemeMaterials,
  disposeThemeMaterials,
  parseCssColor,
  type CharacterMaterials,
} from "./theme-materials";
import { getDefaultTheme } from "../../themes";
import type { RagdollTheme } from "../../themes/types";
import {
  headBulgeParams,
  liftToHeadSurface,
  roundExtrudedOutline,
  subdivideFaces,
  surfaceOffsetZ,
  type HeadBulgeParams,
} from "./bulge-geometry";

const VIEW_WIDTH = 320;
const VIEW_HEIGHT = 380;
const CAMERA_FOV = 30;
const MAX_YAW = (35 * Math.PI) / 180;
const MOUTH_STENCIL = 3;
/** Half of the face extrusion, used so features sit on the bulged front. */
const FACE_FRONT = 11;

type PathKind = "face" | "hair" | "feature" | "ear";

interface ExtrudePart {
  mesh: Mesh;
  path: string;
  depth: number;
  kind: PathKind;
  extraZ: number;
}

interface SpherePart {
  mesh: Mesh;
}

interface LinePart {
  line: Line;
  path: string;
}

function extrudeSettings(depth: number) {
  return {
    depth,
    bevelEnabled: true,
    bevelThickness: Math.min(4.2, depth * 0.28),
    bevelSize: Math.min(3.4, depth * 0.22),
    bevelSegments: 3,
    curveSegments: 12,
  } as const;
}

function stencilWrite(base: MeshStandardMaterial, ref: number): MeshStandardMaterial {
  const material = base.clone();
  material.stencilWrite = true;
  material.stencilRef = ref;
  material.stencilFunc = AlwaysStencilFunc;
  material.stencilFail = KeepStencilOp;
  material.stencilZFail = KeepStencilOp;
  material.stencilZPass = ReplaceStencilOp;
  return material;
}

function stencilRead(base: MeshStandardMaterial, ref: number): MeshStandardMaterial {
  const material = base.clone();
  material.stencilWrite = false;
  material.stencilRef = ref;
  material.stencilFunc = EqualStencilFunc;
  material.stencilFail = KeepStencilOp;
  material.stencilZFail = KeepStencilOp;
  material.stencilZPass = KeepStencilOp;
  return material;
}

function copySurface(target: MeshStandardMaterial, source: MeshStandardMaterial): void {
  target.color.copy(source.color);
  target.opacity = source.opacity;
  target.transparent = source.transparent;
  target.emissive.copy(source.emissive);
  target.emissiveIntensity = source.emissiveIntensity;
  target.roughness = source.roughness;
  target.metalness = source.metalness;
}

function cameraDistanceForView(fovDeg: number, viewHeight: number): number {
  return viewHeight / 2 / Math.tan((fovDeg * Math.PI) / 360);
}

export class CharacterScene {
  private readonly renderer: WebGLRenderer;
  private readonly scene = new Scene();
  private readonly camera: PerspectiveCamera;
  private readonly head = new Group();
  private readonly lights: {
    ambient: AmbientLight;
    hemisphere: HemisphereLight;
    key: DirectionalLight;
    fill: DirectionalLight;
    rim: DirectionalLight;
  };
  private readonly materials: CharacterMaterials;
  private readonly eyeMaterials: {
    leftSclera: MeshStandardMaterial;
    rightSclera: MeshStandardMaterial;
    leftIris: MeshStandardMaterial;
    rightIris: MeshStandardMaterial;
    leftPupil: MeshStandardMaterial;
    rightPupil: MeshStandardMaterial;
    leftHighlight: MeshStandardMaterial;
    rightHighlight: MeshStandardMaterial;
    leftHighlightSoft: MeshStandardMaterial;
    rightHighlightSoft: MeshStandardMaterial;
  };
  private readonly mouthMaterials: {
    opening: MeshStandardMaterial;
    teeth: MeshStandardMaterial;
  };
  private readonly overlays: {
    noseTip: MeshStandardMaterial;
    hairSheen: MeshStandardMaterial;
    lipSheen: MeshStandardMaterial;
  };
  private readonly parts: Record<string, ExtrudePart>;
  private readonly spheres: Record<string, SpherePart>;
  private readonly planes: Record<string, Mesh>;
  private readonly strokes: {
    leftCrease: LinePart;
    rightCrease: LinePart;
  };
  private themeId = "";
  private readonly unitSphere = new SphereGeometry(1, 24, 18);
  private readonly unitPlane = new PlaneGeometry(1, 1);

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
      stencil: true,
    });
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.autoClear = true;
    this.renderer.toneMapping = ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = PCFSoftShadowMap;

    const distance = cameraDistanceForView(CAMERA_FOV, VIEW_HEIGHT);
    this.camera = new PerspectiveCamera(CAMERA_FOV, VIEW_WIDTH / VIEW_HEIGHT, 12, 2400);
    // Slight 3/4 view so cheek, ear, and head depth read as volume.
    this.camera.position.set(distance * 0.22, distance * 0.07, distance * 0.94);
    this.camera.lookAt(0, -10, 28);

    this.materials = createThemeMaterials(getDefaultTheme());

    this.eyeMaterials = {
      leftSclera: stencilWrite(this.materials.sclera, 1),
      rightSclera: stencilWrite(this.materials.sclera, 2),
      leftIris: stencilRead(this.materials.iris, 1),
      rightIris: stencilRead(this.materials.iris, 2),
      leftPupil: stencilRead(this.materials.pupil, 1),
      rightPupil: stencilRead(this.materials.pupil, 2),
      leftHighlight: stencilRead(this.materials.highlight, 1),
      rightHighlight: stencilRead(this.materials.highlight, 2),
      leftHighlightSoft: stencilRead(this.materials.highlight, 1),
      rightHighlightSoft: stencilRead(this.materials.highlight, 2),
    };
    this.mouthMaterials = {
      opening: stencilWrite(this.materials.mouthOpening, MOUTH_STENCIL),
      teeth: stencilRead(this.materials.teeth, MOUTH_STENCIL),
    };
    this.overlays = {
      noseTip: this.materials.skinLight.clone(),
      hairSheen: this.materials.hairLight.clone(),
      lipSheen: this.materials.highlight.clone(),
    };
    this.overlays.noseTip.transparent = false;
    this.overlays.noseTip.depthWrite = true;
    this.overlays.lipSheen.transparent = true;
    this.overlays.lipSheen.depthWrite = false;
    this.overlays.lipSheen.opacity = 0.25;

    this.lights = {
      ambient: new AmbientLight(0xc5d0dc, 0.16),
      hemisphere: new HemisphereLight(0xfff4ea, 0x3a4250, 0.42),
      key: new DirectionalLight(0xfff3e4, 2.35),
      fill: new DirectionalLight(0x8fb4d4, 0.55),
      rim: new DirectionalLight(0xffe4cc, 1.35),
    };
    this.lights.key.position.set(220, 260, 320);
    this.lights.key.castShadow = true;
    this.lights.key.shadow.mapSize.set(1024, 1024);
    this.lights.key.shadow.bias = -0.0008;
    this.lights.key.shadow.normalBias = 0.8;
    const shadowCam = this.lights.key.shadow.camera;
    shadowCam.left = -180;
    shadowCam.right = 180;
    shadowCam.top = 200;
    shadowCam.bottom = -200;
    shadowCam.near = 40;
    shadowCam.far = 700;
    this.lights.fill.position.set(-240, 40, 140);
    this.lights.rim.position.set(-90, 90, -260);
    this.scene.add(
      this.lights.ambient,
      this.lights.hemisphere,
      this.lights.key,
      this.lights.fill,
      this.lights.rim,
    );
    this.scene.add(this.head);

    this.parts = {
      leftEar: this.pathPart(this.materials.skin, 18, 0, "ear", 0, true),
      rightEar: this.pathPart(this.materials.skin, 18, 0, "ear", 0, true),
      face: this.pathPart(this.materials.skinFace, 22, 1, "face", 0, true),
      leftSclera: this.pathPart(this.eyeMaterials.leftSclera, 4, 10, "feature", 2),
      rightSclera: this.pathPart(this.eyeMaterials.rightSclera, 4, 10, "feature", 2),
      leftUpperLid: this.pathPart(this.materials.lid, 3.2, 14, "feature", 4),
      leftLowerLid: this.pathPart(this.materials.lid, 3.2, 14, "feature", 4),
      rightUpperLid: this.pathPart(this.materials.lid, 3.2, 14, "feature", 4),
      rightLowerLid: this.pathPart(this.materials.lid, 3.2, 14, "feature", 4),
      leftBrow: this.pathPart(this.materials.brow, 5.5, 15, "feature", 5),
      rightBrow: this.pathPart(this.materials.brow, 5.5, 15, "feature", 5),
      nose: this.pathPart(this.materials.nose, 10, 16, "feature", 10, true),
      mouthOpening: this.pathPart(this.mouthMaterials.opening, 5, 17, "feature", 4),
      upperLip: this.pathPart(this.materials.upperLip, 5.5, 19, "feature", 6),
      lowerLip: this.pathPart(this.materials.lowerLip, 6, 19, "feature", 6),
      mustache: this.pathPart(this.materials.hair, 6, 20, "feature", 7, true),
      hair: this.pathPart(this.materials.hair, 16, 21, "hair", 0, true),
    };

    this.spheres = {
      leftIris: this.spherePart(this.eyeMaterials.leftIris, 11),
      rightIris: this.spherePart(this.eyeMaterials.rightIris, 11),
      leftPupil: this.spherePart(this.eyeMaterials.leftPupil, 12),
      rightPupil: this.spherePart(this.eyeMaterials.rightPupil, 12),
      leftHighlightA: this.spherePart(this.eyeMaterials.leftHighlight, 13),
      leftHighlightB: this.spherePart(this.eyeMaterials.leftHighlightSoft, 13),
      rightHighlightA: this.spherePart(this.eyeMaterials.rightHighlight, 13),
      rightHighlightB: this.spherePart(this.eyeMaterials.rightHighlightSoft, 13),
      noseTip: this.spherePart(this.overlays.noseTip, 16, true),
      hairHighlight: this.spherePart(this.overlays.hairSheen, 22),
    };

    this.planes = {
      shadow: this.planePart(this.materials.shadow, 2),
      blushLeft: this.planePart(this.materials.blush, 3),
      blushRight: this.planePart(this.materials.blush, 3),
      teeth: this.planePart(this.mouthMaterials.teeth, 18),
      lipHighlight: this.planePart(this.overlays.lipSheen, 20),
    };

    this.strokes = {
      leftCrease: this.linePart(this.materials.crease, 14),
      rightCrease: this.linePart(this.materials.crease, 14),
    };

    this.syncEyeMaterials();
    this.syncMouthMaterials();
    this.syncOverlayMaterials();
    this.tintLights(getDefaultTheme());
  }

  setSize(width: number, height: number): void {
    if (width <= 0 || height <= 0) return;
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.render(this.scene, this.camera);
  }

  setData(data: RenderData): void {
    if (this.themeId !== data.currentTheme.id) {
      this.themeId = data.currentTheme.id;
      applyThemeToMaterials(this.materials, data.currentTheme);
      this.syncEyeMaterials();
      this.syncMouthMaterials();
      this.syncOverlayMaterials();
      this.tintLights(data.currentTheme);
    }

    this.head.rotation.set(data.pitch, data.yaw, -data.headRoll);
    this.head.position.set(0, -data.breathingOffsetY, 0);
    this.head.scale.setScalar(data.breathingScale);

    const bulge = headBulgeParams(data.dims.headWidth, data.dims.headHeight);

    this.updatePath(this.parts.leftEar, data.leftEarPath, bulge);
    this.updatePath(this.parts.rightEar, data.rightEarPath, bulge);
    this.updatePath(this.parts.face, data.facePath, bulge);
    this.updatePath(this.parts.leftSclera, data.leftEyePaths.sclera, bulge);
    this.updatePath(this.parts.rightSclera, data.rightEyePaths.sclera, bulge);
    this.updatePath(this.parts.leftUpperLid, data.leftEyePaths.upperLid, bulge);
    this.updatePath(this.parts.leftLowerLid, data.leftEyePaths.lowerLid, bulge);
    this.updatePath(this.parts.rightUpperLid, data.rightEyePaths.upperLid, bulge);
    this.updatePath(this.parts.rightLowerLid, data.rightEyePaths.lowerLid, bulge);
    this.updatePath(this.parts.leftBrow, data.leftEyebrowPath, bulge);
    this.updatePath(this.parts.rightBrow, data.rightEyebrowPath, bulge);
    this.updatePath(this.parts.nose, data.nosePath, bulge);
    this.updatePath(this.parts.mouthOpening, data.mouthPaths.opening, bulge);
    this.updatePath(this.parts.upperLip, data.mouthPaths.upperLip, bulge);
    this.updatePath(this.parts.lowerLip, data.mouthPaths.lowerLip, bulge);
    this.updatePath(this.parts.mustache, data.mustachePath, bulge);
    this.updatePath(this.parts.hair, data.hairPath, bulge);

    this.placeSphere(
      this.spheres.leftIris,
      data.leftIris.cx,
      data.leftIris.cy,
      data.leftIris.irisR,
      bulge,
      6,
    );
    this.placeSphere(
      this.spheres.rightIris,
      data.rightIris.cx,
      data.rightIris.cy,
      data.rightIris.irisR,
      bulge,
      6,
    );
    this.placeSphere(
      this.spheres.leftPupil,
      data.leftIris.cx,
      data.leftIris.cy,
      data.leftIris.pupilR,
      bulge,
      9,
    );
    this.placeSphere(
      this.spheres.rightPupil,
      data.rightIris.cx,
      data.rightIris.cy,
      data.rightIris.pupilR,
      bulge,
      9,
    );
    this.placeSphere(
      this.spheres.leftHighlightA,
      data.leftIris.cx - 2,
      data.leftIris.cy - 2,
      data.leftIris.pupilR * 0.55,
      bulge,
      12,
    );
    this.placeSphere(
      this.spheres.leftHighlightB,
      data.leftIris.cx + 3,
      data.leftIris.cy + 1,
      data.leftIris.pupilR * 0.28,
      bulge,
      13,
    );
    this.placeSphere(
      this.spheres.rightHighlightA,
      data.rightIris.cx - 2,
      data.rightIris.cy - 2,
      data.rightIris.pupilR * 0.55,
      bulge,
      12,
    );
    this.placeSphere(
      this.spheres.rightHighlightB,
      data.rightIris.cx + 3,
      data.rightIris.cy + 1,
      data.rightIris.pupilR * 0.28,
      bulge,
      13,
    );
    const leftEyeOpen = data.leftEyePaths.aperture.height > 2;
    const rightEyeOpen = data.rightEyePaths.aperture.height > 2;
    this.spheres.leftIris.mesh.visible = leftEyeOpen;
    this.spheres.leftPupil.mesh.visible = leftEyeOpen;
    this.spheres.leftHighlightA.mesh.visible = leftEyeOpen;
    this.spheres.leftHighlightB.mesh.visible = leftEyeOpen;
    this.spheres.rightIris.mesh.visible = rightEyeOpen;
    this.spheres.rightPupil.mesh.visible = rightEyeOpen;
    this.spheres.rightHighlightA.mesh.visible = rightEyeOpen;
    this.spheres.rightHighlightB.mesh.visible = rightEyeOpen;
    this.placeSphere(
      this.spheres.noseTip,
      0,
      data.dims.noseY + data.dims.noseHeight * 0.3,
      6.5,
      bulge,
      14,
    );
    this.spheres.hairHighlight.mesh.visible = data.hairPath.trim().length > 0;
    this.placeSphere(
      this.spheres.hairHighlight,
      -20,
      -data.dims.headHeight / 2 + 15,
      18,
      bulge,
      8,
      0.45,
      0.7,
    );

    const yawNorm = Math.max(-1, Math.min(1, data.yaw / MAX_YAW));
    const shadowIntensity = Math.abs(yawNorm) * 0.18;
    const shadow = this.planes.shadow;
    shadow.visible = shadowIntensity > 0.02;
    const shadowX = (yawNorm > 0 ? -1 : 1) * (data.dims.headWidth / 3);
    shadow.position.set(
      shadowX,
      0,
      this.headZ(shadowX, 0, bulge, 1),
    );
    shadow.scale.set(60, data.dims.headHeight - 30, 1);
    this.materials.shadow.opacity = shadowIntensity;

    const blushOpacity = 0.5 + data.expression.cheekPuff * 0.5;
    this.placeEllipse(
      this.planes.blushLeft,
      -data.dims.headWidth / 4,
      data.dims.eyeY + 25,
      18,
      12,
      blushOpacity,
      bulge,
      3,
    );
    this.placeEllipse(
      this.planes.blushRight,
      data.dims.headWidth / 4,
      data.dims.eyeY + 25,
      18,
      12,
      blushOpacity,
      bulge,
      3,
    );

    const openingHeight = data.mouthPaths.openingHeight;
    const teeth = this.planes.teeth;
    if (openingHeight > 6) {
      const mouthWidth = data.dims.mouthWidth * data.expression.mouth.width;
      const teethWidth = Math.min(mouthWidth * 0.6, mouthWidth * 1.5);
      const teethHeight = Math.min(8, openingHeight * 0.5);
      const teethY = -(
        data.dims.mouthY +
        data.expression.mouth.upperLipBottom +
        2 +
        teethHeight / 2
      );
      teeth.visible = true;
      teeth.position.set(0, teethY, this.headZ(0, teethY, bulge, 5));
      teeth.scale.set(teethWidth, teethHeight, 1);
    } else {
      teeth.visible = false;
    }

    this.placeEllipse(
      this.planes.lipHighlight,
      0,
      data.dims.mouthY + data.expression.mouth.lowerLipBottom - 4,
      data.dims.mouthWidth * data.expression.mouth.width * 0.25,
      2,
      0.25,
      bulge,
      8,
    );

    this.updateStroke(this.strokes.leftCrease, data.leftCreasePath, bulge, 6);
    this.updateStroke(this.strokes.rightCrease, data.rightCreasePath, bulge, 6);

    this.renderer.render(this.scene, this.camera);
  }

  dispose(): void {
    for (const part of Object.values(this.parts)) {
      part.mesh.geometry.dispose();
    }
    for (const stroke of Object.values(this.strokes)) {
      stroke.line.geometry.dispose();
    }
    this.unitSphere.dispose();
    this.unitPlane.dispose();
    for (const material of Object.values(this.eyeMaterials)) {
      material.dispose();
    }
    for (const material of Object.values(this.mouthMaterials)) {
      material.dispose();
    }
    for (const material of Object.values(this.overlays)) {
      material.dispose();
    }
    disposeThemeMaterials(this.materials);
    this.renderer.dispose();
  }

  private pathPart(
    material: Material,
    depth: number,
    renderOrder: number,
    kind: PathKind,
    extraZ = 0,
    shadows = false,
  ): ExtrudePart {
    const mesh = new Mesh(new BufferGeometry(), material);
    mesh.renderOrder = renderOrder;
    mesh.castShadow = shadows;
    mesh.receiveShadow = shadows;
    this.head.add(mesh);
    return { mesh, path: "", depth, kind, extraZ };
  }

  private spherePart(
    material: Material,
    renderOrder: number,
    shadows = false,
  ): SpherePart {
    const mesh = new Mesh(this.unitSphere, material);
    mesh.renderOrder = renderOrder;
    mesh.castShadow = shadows;
    this.head.add(mesh);
    return { mesh };
  }

  private planePart(material: Material, renderOrder: number): Mesh {
    const mesh = new Mesh(this.unitPlane, material);
    mesh.renderOrder = renderOrder;
    this.head.add(mesh);
    return mesh;
  }

  private linePart(material: Material, renderOrder: number): LinePart {
    const line = new Line(new BufferGeometry(), material);
    line.renderOrder = renderOrder;
    this.head.add(line);
    return { line, path: "" };
  }

  private updatePath(
    part: ExtrudePart,
    path: string,
    bulge: HeadBulgeParams,
  ): void {
    if (!path.trim()) {
      part.path = path;
      part.mesh.visible = false;
      return;
    }
    if (path === part.path) {
      part.mesh.visible = true;
      return;
    }
    const shape = svgPathToShape(path);
    part.path = path;
    if (!shape) {
      part.mesh.visible = false;
      return;
    }
    try {
      let geometry: BufferGeometry = new ExtrudeGeometry(
        shape,
        extrudeSettings(part.depth),
      );
      geometry.translate(0, 0, -part.depth / 2);
      if (part.kind === "face") {
        const rounded = roundExtrudedOutline(
          geometry,
          bulge.radiusX,
          bulge.radiusY,
          bulge.amount,
        );
        geometry.dispose();
        geometry = rounded;
      } else if (part.kind === "hair") {
        const rounded = roundExtrudedOutline(
          geometry,
          bulge.radiusX * 1.1,
          bulge.radiusY * 1.14,
          bulge.amount * 0.82,
        );
        geometry.dispose();
        geometry = rounded;
        geometry.translate(0, 0, 6);
      } else if (part.kind === "ear") {
        geometry.translate(0, 0, -14);
      } else {
        const subdivided = subdivideFaces(geometry, 22);
        if (subdivided !== geometry) geometry.dispose();
        geometry = subdivided;
        liftToHeadSurface(
          geometry,
          bulge.radiusX,
          bulge.radiusY,
          bulge.amount,
          FACE_FRONT + part.extraZ,
        );
      }
      part.mesh.geometry.dispose();
      part.mesh.geometry = geometry;
      part.mesh.visible = true;
    } catch {
      part.mesh.visible = false;
    }
  }

  private updateStroke(
    part: LinePart,
    path: string,
    bulge: HeadBulgeParams,
    extraZ: number,
  ): void {
    if (!path.trim()) {
      part.path = path;
      part.line.visible = false;
      return;
    }
    if (path === part.path) {
      part.line.visible = true;
      return;
    }
    const shape = svgPathToShape(path, { close: false });
    part.path = path;
    if (!shape) {
      part.line.visible = false;
      return;
    }
    const points = shape.getPoints(16).map(
      (point) =>
        new Vector3(
          point.x,
          point.y,
          this.headZ(point.x, point.y, bulge, extraZ),
        ),
    );
    part.line.geometry.dispose();
    part.line.geometry = new BufferGeometry().setFromPoints(points);
    part.line.visible = true;
  }

  private placeSphere(
    part: SpherePart,
    cx: number,
    cy: number,
    radius: number,
    bulge: HeadBulgeParams,
    extraZ: number,
    yScale = 1,
    zScale = 1,
  ): void {
    part.mesh.visible = radius > 0;
    const x = cx;
    const y = -cy;
    part.mesh.position.set(x, y, this.headZ(x, y, bulge, extraZ));
    part.mesh.scale.set(radius, radius * yScale, radius * zScale);
  }

  private placeEllipse(
    mesh: Mesh,
    cx: number,
    cy: number,
    rx: number,
    ry: number,
    opacity: number,
    bulge: HeadBulgeParams,
    extraZ: number,
  ): void {
    mesh.visible = opacity > 0.02 && rx > 0 && ry > 0;
    const x = cx;
    const y = -cy;
    mesh.position.set(x, y, this.headZ(x, y, bulge, extraZ));
    mesh.scale.set(rx * 2, ry * 2, 1);
    if (mesh.material instanceof MeshStandardMaterial) {
      mesh.material.opacity = opacity;
      mesh.material.transparent = opacity < 1;
    }
  }

  private headZ(
    x: number,
    y: number,
    bulge: HeadBulgeParams,
    extraZ: number,
  ): number {
    return (
      surfaceOffsetZ(x, y, bulge.radiusX, bulge.radiusY, bulge.amount) +
      FACE_FRONT +
      extraZ
    );
  }

  private syncEyeMaterials(): void {
    copySurface(this.eyeMaterials.leftSclera, this.materials.sclera);
    copySurface(this.eyeMaterials.rightSclera, this.materials.sclera);
    copySurface(this.eyeMaterials.leftIris, this.materials.iris);
    copySurface(this.eyeMaterials.rightIris, this.materials.iris);
    copySurface(this.eyeMaterials.leftPupil, this.materials.pupil);
    copySurface(this.eyeMaterials.rightPupil, this.materials.pupil);
    copySurface(this.eyeMaterials.leftHighlight, this.materials.highlight);
    copySurface(this.eyeMaterials.rightHighlight, this.materials.highlight);
    copySurface(this.eyeMaterials.leftHighlightSoft, this.materials.highlight);
    copySurface(this.eyeMaterials.rightHighlightSoft, this.materials.highlight);
    this.eyeMaterials.leftHighlight.opacity = 0.85;
    this.eyeMaterials.rightHighlight.opacity = 0.85;
    this.eyeMaterials.leftHighlightSoft.opacity = 0.4;
    this.eyeMaterials.rightHighlightSoft.opacity = 0.4;
  }

  private syncMouthMaterials(): void {
    copySurface(this.mouthMaterials.opening, this.materials.mouthOpening);
    copySurface(this.mouthMaterials.teeth, this.materials.teeth);
  }

  private syncOverlayMaterials(): void {
    copySurface(this.overlays.noseTip, this.materials.skinLight);
    this.overlays.noseTip.opacity = 1;
    this.overlays.noseTip.transparent = false;
    this.overlays.noseTip.depthWrite = true;
    copySurface(this.overlays.hairSheen, this.materials.hairLight);
    this.overlays.hairSheen.opacity = 0.32;
    this.overlays.hairSheen.transparent = true;
    this.overlays.hairSheen.depthWrite = false;
    copySurface(this.overlays.lipSheen, this.materials.highlight);
    this.overlays.lipSheen.opacity = 0.25;
    this.overlays.lipSheen.transparent = true;
    this.overlays.lipSheen.depthWrite = false;
  }

  private tintLights(theme: RagdollTheme): void {
    const skinLight = parseCssColor(theme.colors.skin.light).color;
    const skinDark = parseCssColor(theme.colors.skin.dark).color;
    const highlight = parseCssColor(theme.colors.highlight).color;
    this.lights.ambient.color.setHex(0xc5d0dc);
    this.lights.hemisphere.color.copy(highlight);
    this.lights.hemisphere.groundColor.copy(skinDark);
    this.lights.key.color.setHex(0xfff3e4);
    this.lights.fill.color.lerpColors(skinLight, new Color(0x88aacc), 0.55);
    this.lights.rim.color.copy(highlight);
  }
}
