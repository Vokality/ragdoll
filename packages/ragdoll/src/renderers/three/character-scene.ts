import {
  AmbientLight,
  AlwaysStencilFunc,
  CircleGeometry,
  DirectionalLight,
  EqualStencilFunc,
  ExtrudeGeometry,
  Group,
  HemisphereLight,
  KeepStencilOp,
  Line,
  BufferGeometry,
  Mesh,
  MeshStandardMaterial,
  OrthographicCamera,
  PlaneGeometry,
  ReplaceStencilOp,
  Scene,
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

const VIEW_WIDTH = 320;
const VIEW_HEIGHT = 380;
const MAX_YAW = (35 * Math.PI) / 180;
const MOUTH_STENCIL = 3;

interface ExtrudePart {
  mesh: Mesh;
  path: string;
  depth: number;
}

interface CirclePart {
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
    bevelThickness: Math.min(1.3, depth * 0.12),
    bevelSize: Math.min(1.05, depth * 0.1),
    bevelSegments: 1,
    curveSegments: 8,
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

export class CharacterScene {
  private readonly renderer: WebGLRenderer;
  private readonly scene = new Scene();
  private readonly camera: OrthographicCamera;
  private readonly head = new Group();
  private readonly lights: {
    ambient: AmbientLight;
    hemisphere: HemisphereLight;
    key: DirectionalLight;
    fill: DirectionalLight;
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
  private readonly circles: Record<string, CirclePart>;
  private readonly planes: Record<string, Mesh>;
  private readonly strokes: {
    leftCrease: LinePart;
    rightCrease: LinePart;
    face: LinePart;
  };
  private themeId = "";
  private readonly unitCircle = new CircleGeometry(1, 28);
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

    this.camera = new OrthographicCamera(
      -VIEW_WIDTH / 2,
      VIEW_WIDTH / 2,
      VIEW_HEIGHT / 2,
      -VIEW_HEIGHT / 2,
      0.1,
      800,
    );
    this.camera.position.set(0, 0, 240);

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
    this.overlays.lipSheen.transparent = true;
    this.overlays.lipSheen.depthWrite = false;
    this.overlays.lipSheen.opacity = 0.25;

    this.lights = {
      ambient: new AmbientLight(0xffffff, 0.32),
      hemisphere: new HemisphereLight(0xffffff, 0x887766, 0.55),
      key: new DirectionalLight(0xffffff, 0.9),
      fill: new DirectionalLight(0xffffff, 0.28),
    };
    this.lights.key.position.set(-70, 90, 160);
    this.lights.fill.position.set(80, 20, 90);
    this.scene.add(
      this.lights.ambient,
      this.lights.hemisphere,
      this.lights.key,
      this.lights.fill,
    );
    this.scene.add(this.head);

    this.parts = {
      leftEar: this.pathPart(this.materials.skin, 6, -8, 0),
      rightEar: this.pathPart(this.materials.skin, 6, -8, 0),
      face: this.pathPart(this.materials.skinFace, 16, 0, 1),
      leftSclera: this.pathPart(this.eyeMaterials.leftSclera, 2.2, 10, 10),
      rightSclera: this.pathPart(this.eyeMaterials.rightSclera, 2.2, 10, 10),
      leftUpperLid: this.pathPart(this.materials.lid, 2, 11.5, 14),
      leftLowerLid: this.pathPart(this.materials.lid, 2, 11.5, 14),
      rightUpperLid: this.pathPart(this.materials.lid, 2, 11.5, 14),
      rightLowerLid: this.pathPart(this.materials.lid, 2, 11.5, 14),
      leftBrow: this.pathPart(this.materials.brow, 2.4, 13, 15),
      rightBrow: this.pathPart(this.materials.brow, 2.4, 13, 15),
      nose: this.pathPart(this.materials.nose, 6, 14, 16),
      mouthOpening: this.pathPart(this.mouthMaterials.opening, 2, 11, 17),
      upperLip: this.pathPart(this.materials.upperLip, 3.2, 12, 19),
      lowerLip: this.pathPart(this.materials.lowerLip, 3.4, 12.4, 19),
      mustache: this.pathPart(this.materials.hair, 3, 13, 20),
      hair: this.pathPart(this.materials.hair, 10, 8, 21),
    };

    this.circles = {
      leftIris: this.circlePart(this.eyeMaterials.leftIris, 12, 11),
      rightIris: this.circlePart(this.eyeMaterials.rightIris, 12, 11),
      leftPupil: this.circlePart(this.eyeMaterials.leftPupil, 12.4, 12),
      rightPupil: this.circlePart(this.eyeMaterials.rightPupil, 12.4, 12),
      leftHighlightA: this.circlePart(this.eyeMaterials.leftHighlight, 12.8, 13),
      leftHighlightB: this.circlePart(this.eyeMaterials.leftHighlightSoft, 12.8, 13),
      rightHighlightA: this.circlePart(this.eyeMaterials.rightHighlight, 12.8, 13),
      rightHighlightB: this.circlePart(this.eyeMaterials.rightHighlightSoft, 12.8, 13),
      noseTip: this.circlePart(this.overlays.noseTip, 16, 16),
      hairHighlight: this.circlePart(this.overlays.hairSheen, 14, 22),
    };

    this.planes = {
      shadow: this.planePart(this.materials.shadow, 7, 2),
      blushLeft: this.planePart(this.materials.blush, 8, 3),
      blushRight: this.planePart(this.materials.blush, 8, 3),
      teeth: this.planePart(this.mouthMaterials.teeth, 11.2, 18),
      lipHighlight: this.planePart(this.overlays.lipSheen, 12.8, 20),
    };

    this.strokes = {
      face: this.linePart(this.materials.stroke, 8.2, 2),
      leftCrease: this.linePart(this.materials.crease, 14, 14),
      rightCrease: this.linePart(this.materials.crease, 14, 14),
    };

    this.syncEyeMaterials();
    this.syncMouthMaterials();
    this.syncOverlayMaterials();
    this.tintLights(getDefaultTheme());
  }

  setSize(width: number, height: number): void {
    if (width <= 0 || height <= 0) return;
    this.renderer.setSize(width, height, false);
    const canvasAspect = width / height;
    const viewAspect = VIEW_WIDTH / VIEW_HEIGHT;
    if (canvasAspect > viewAspect) {
      const halfHeight = VIEW_HEIGHT / 2;
      const halfWidth = halfHeight * canvasAspect;
      this.camera.left = -halfWidth;
      this.camera.right = halfWidth;
      this.camera.top = halfHeight;
      this.camera.bottom = -halfHeight;
    } else {
      const halfWidth = VIEW_WIDTH / 2;
      const halfHeight = halfWidth / canvasAspect;
      this.camera.left = -halfWidth;
      this.camera.right = halfWidth;
      this.camera.top = halfHeight;
      this.camera.bottom = -halfHeight;
    }
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

    this.updatePath(this.parts.leftEar, data.leftEarPath);
    this.updatePath(this.parts.rightEar, data.rightEarPath);
    this.updatePath(this.parts.face, data.facePath);
    this.updateStroke(this.strokes.face, data.facePath);
    this.updatePath(this.parts.leftSclera, data.leftEyePaths.sclera);
    this.updatePath(this.parts.rightSclera, data.rightEyePaths.sclera);
    this.updatePath(this.parts.leftUpperLid, data.leftEyePaths.upperLid);
    this.updatePath(this.parts.leftLowerLid, data.leftEyePaths.lowerLid);
    this.updatePath(this.parts.rightUpperLid, data.rightEyePaths.upperLid);
    this.updatePath(this.parts.rightLowerLid, data.rightEyePaths.lowerLid);
    this.updatePath(this.parts.leftBrow, data.leftEyebrowPath);
    this.updatePath(this.parts.rightBrow, data.rightEyebrowPath);
    this.updatePath(this.parts.nose, data.nosePath);
    this.updatePath(this.parts.mouthOpening, data.mouthPaths.opening);
    this.updatePath(this.parts.upperLip, data.mouthPaths.upperLip);
    this.updatePath(this.parts.lowerLip, data.mouthPaths.lowerLip);
    this.updatePath(this.parts.mustache, data.mustachePath);
    this.updatePath(this.parts.hair, data.hairPath);

    this.placeCircle(
      this.circles.leftIris,
      data.leftIris.cx,
      data.leftIris.cy,
      data.leftIris.irisR,
    );
    this.placeCircle(
      this.circles.rightIris,
      data.rightIris.cx,
      data.rightIris.cy,
      data.rightIris.irisR,
    );
    this.placeCircle(
      this.circles.leftPupil,
      data.leftIris.cx,
      data.leftIris.cy,
      data.leftIris.pupilR,
    );
    this.placeCircle(
      this.circles.rightPupil,
      data.rightIris.cx,
      data.rightIris.cy,
      data.rightIris.pupilR,
    );
    this.placeCircle(
      this.circles.leftHighlightA,
      data.leftIris.cx - 2,
      data.leftIris.cy - 2,
      data.leftIris.pupilR * 0.6,
    );
    this.placeCircle(
      this.circles.leftHighlightB,
      data.leftIris.cx + 3,
      data.leftIris.cy + 1,
      data.leftIris.pupilR * 0.3,
    );
    this.placeCircle(
      this.circles.rightHighlightA,
      data.rightIris.cx - 2,
      data.rightIris.cy - 2,
      data.rightIris.pupilR * 0.6,
    );
    this.placeCircle(
      this.circles.rightHighlightB,
      data.rightIris.cx + 3,
      data.rightIris.cy + 1,
      data.rightIris.pupilR * 0.3,
    );
    this.placeCircle(
      this.circles.noseTip,
      0,
      data.dims.noseY + data.dims.noseHeight * 0.3,
      4,
      3 / 4,
    );
    this.circles.hairHighlight.mesh.visible = data.hairPath.trim().length > 0;
    this.placeCircle(
      this.circles.hairHighlight,
      -20,
      -data.dims.headHeight / 2 + 15,
      25,
      10 / 25,
    );

    const yawNorm = Math.max(-1, Math.min(1, data.yaw / MAX_YAW));
    const shadowIntensity = Math.abs(yawNorm) * 0.15;
    const shadow = this.planes.shadow;
    shadow.visible = shadowIntensity > 0.02;
    shadow.position.set(
      (yawNorm > 0 ? -1 : 1) * (data.dims.headWidth / 3),
      0,
      7,
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
    );
    this.placeEllipse(
      this.planes.blushRight,
      data.dims.headWidth / 4,
      data.dims.eyeY + 25,
      18,
      12,
      blushOpacity,
    );

    const openingHeight = data.mouthPaths.openingHeight;
    const teeth = this.planes.teeth;
    if (openingHeight > 6) {
      const mouthWidth = data.dims.mouthWidth * data.expression.mouth.width;
      const teethWidth = Math.min(mouthWidth * 0.6, mouthWidth * 1.5);
      const teethHeight = Math.min(8, openingHeight * 0.5);
      teeth.visible = true;
      teeth.position.set(
        0,
        -(data.dims.mouthY + data.expression.mouth.upperLipBottom + 2 + teethHeight / 2),
        11.2,
      );
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
    );

    this.updateStroke(this.strokes.leftCrease, data.leftCreasePath);
    this.updateStroke(this.strokes.rightCrease, data.rightCreasePath);

    this.renderer.render(this.scene, this.camera);
  }

  dispose(): void {
    for (const part of Object.values(this.parts)) {
      part.mesh.geometry.dispose();
    }
    for (const stroke of Object.values(this.strokes)) {
      stroke.line.geometry.dispose();
    }
    this.unitCircle.dispose();
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
    z: number,
    renderOrder: number,
  ): ExtrudePart {
    const mesh = new Mesh(new BufferGeometry(), material);
    mesh.position.z = z;
    mesh.renderOrder = renderOrder;
    this.head.add(mesh);
    return { mesh, path: "", depth };
  }

  private circlePart(
    material: Material,
    z: number,
    renderOrder: number,
  ): CirclePart {
    const mesh = new Mesh(this.unitCircle, material);
    mesh.position.z = z;
    mesh.renderOrder = renderOrder;
    this.head.add(mesh);
    return { mesh };
  }

  private planePart(
    material: Material,
    z: number,
    renderOrder: number,
  ): Mesh {
    const mesh = new Mesh(this.unitPlane, material);
    mesh.position.z = z;
    mesh.renderOrder = renderOrder;
    this.head.add(mesh);
    return mesh;
  }

  private linePart(material: Material, z: number, renderOrder: number): LinePart {
    const line = new Line(new BufferGeometry(), material);
    line.position.z = z;
    line.renderOrder = renderOrder;
    this.head.add(line);
    return { line, path: "" };
  }

  private updatePath(part: ExtrudePart, path: string): void {
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
      const geometry = new ExtrudeGeometry(shape, extrudeSettings(part.depth));
      geometry.translate(0, 0, -part.depth / 2);
      part.mesh.geometry.dispose();
      part.mesh.geometry = geometry;
      part.mesh.visible = true;
    } catch {
      part.mesh.visible = false;
    }
  }

  private updateStroke(part: LinePart, path: string): void {
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
    const points = shape.getPoints(16).map((point) => new Vector3(point.x, point.y, 0));
    part.line.geometry.dispose();
    part.line.geometry = new BufferGeometry().setFromPoints(points);
    part.line.visible = true;
  }

  private placeCircle(
    part: CirclePart,
    cx: number,
    cy: number,
    radius: number,
    yScale = 1,
  ): void {
    part.mesh.visible = radius > 0;
    part.mesh.position.x = cx;
    part.mesh.position.y = -cy;
    part.mesh.scale.set(radius, radius * yScale, 1);
  }

  private placeEllipse(
    mesh: Mesh,
    cx: number,
    cy: number,
    rx: number,
    ry: number,
    opacity: number,
  ): void {
    mesh.visible = opacity > 0.02 && rx > 0 && ry > 0;
    mesh.position.x = cx;
    mesh.position.y = -cy;
    mesh.scale.set(rx * 2, ry * 2, 1);
    if (mesh.material instanceof MeshStandardMaterial) {
      mesh.material.opacity = opacity;
      mesh.material.transparent = opacity < 1;
    }
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
    this.eyeMaterials.leftHighlight.opacity = 0.8;
    this.eyeMaterials.rightHighlight.opacity = 0.8;
    this.eyeMaterials.leftHighlightSoft.opacity = 0.4;
    this.eyeMaterials.rightHighlightSoft.opacity = 0.4;
  }

  private syncMouthMaterials(): void {
    copySurface(this.mouthMaterials.opening, this.materials.mouthOpening);
    copySurface(this.mouthMaterials.teeth, this.materials.teeth);
  }

  private syncOverlayMaterials(): void {
    copySurface(this.overlays.noseTip, this.materials.skinLight);
    this.overlays.noseTip.opacity = 0.4;
    this.overlays.noseTip.transparent = true;
    this.overlays.noseTip.depthWrite = false;
    copySurface(this.overlays.hairSheen, this.materials.hairLight);
    this.overlays.hairSheen.opacity = 0.3;
    this.overlays.hairSheen.transparent = true;
    this.overlays.hairSheen.depthWrite = false;
    copySurface(this.overlays.lipSheen, this.materials.highlight);
    this.overlays.lipSheen.opacity = 0.25;
    this.overlays.lipSheen.transparent = true;
    this.overlays.lipSheen.depthWrite = false;
  }

  private tintLights(theme: RagdollTheme): void {
    this.lights.ambient.color.copy(parseCssColor(theme.colors.skin.light).color);
    this.lights.hemisphere.color.copy(parseCssColor(theme.colors.highlight).color);
    this.lights.hemisphere.groundColor.copy(
      parseCssColor(theme.colors.skin.dark).color,
    );
    this.lights.key.color.copy(parseCssColor(theme.colors.highlight).color);
    this.lights.fill.color.copy(parseCssColor(theme.colors.skin.light).color);
  }
}
