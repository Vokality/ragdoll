import {
  BufferGeometry,
  Color,
  Float32BufferAttribute,
  Group,
  Mesh,
  MeshStandardMaterial,
  Ray,
  Vector3,
} from "three";
import { Octree } from "three/addons/math/Octree.js";
import type { RenderData } from "../../components/render-data";
import { createSkinDetail } from "./skin-detail";
import { createEyeTexture } from "./eye-texture";
import { anatomicalParts } from "./assets/anatomical-head-data";

export type MorphName =
  | "browInnerUp"
  | "browDown_L"
  | "browDown_R"
  | "browOuterUp_L"
  | "browOuterUp_R"
  | "eyeLookUp_L"
  | "eyeLookUp_R"
  | "eyeLookDown_L"
  | "eyeLookDown_R"
  | "eyeLookIn_L"
  | "eyeLookIn_R"
  | "eyeLookOut_L"
  | "eyeLookOut_R"
  | "eyeBlink_L"
  | "eyeBlink_R"
  | "eyeSquint_L"
  | "eyeSquint_R"
  | "eyeWide_L"
  | "eyeWide_R"
  | "cheekPuff"
  | "cheekSquint_L"
  | "cheekSquint_R"
  | "noseSneer_L"
  | "noseSneer_R"
  | "jawOpen"
  | "jawForward"
  | "jawLeft"
  | "jawRight"
  | "mouthFunnel"
  | "mouthPucker"
  | "mouthLeft"
  | "mouthRight"
  | "mouthRollUpper"
  | "mouthRollLower"
  | "mouthShrugUpper"
  | "mouthShrugLower"
  | "mouthClose"
  | "mouthSmile_L"
  | "mouthSmile_R"
  | "mouthFrown_L"
  | "mouthFrown_R"
  | "mouthDimple_L"
  | "mouthDimple_R"
  | "mouthUpperUp_L"
  | "mouthUpperUp_R"
  | "mouthLowerDown_L"
  | "mouthLowerDown_R"
  | "mouthPress_L"
  | "mouthPress_R"
  | "mouthStretch_L"
  | "mouthStretch_R"
  | "tongueOut";

export interface AnatomicalPart {
  role: "leftEye" | "rightEye" | "face" | "teeth";
  regions: { material: "skin" | "teeth" | "mouth"; vertices: number[] }[];
  positions: number[];
  indices: number[];
  morphs: { name: MorphName; vertices: number[]; deltas: number[] }[];
}

// Only the bundled, immutable parts are keys; instances own cloned GPU attributes.
const normalTemplates = new Map<AnatomicalPart, Float32BufferAttribute[]>();

/** Artist-authored topology with complete eyelids, lips, ears, jaw, and expression shapes. */
export class AnatomicalHead {
  readonly root = new Group();
  readonly skin: Mesh<BufferGeometry, MeshStandardMaterial>;
  private readonly parts: {
    source: AnatomicalPart;
    mesh: Mesh<BufferGeometry, MeshStandardMaterial>;
  }[] = [];
  private readonly ray = new Ray();
  private readonly scalpIndex = new Octree();
  private readonly scalp = new Mesh(
    new BufferGeometry(),
    new MeshStandardMaterial(),
  );
  private identityKey = "";
  private eyeKey = "";

  constructor() {
    for (const source of anatomicalParts) {
      const geometry = new BufferGeometry();
      geometry.setAttribute(
        "position",
        new Float32BufferAttribute(source.positions, 3),
      );
      geometry.setIndex(source.indices);
      geometry.computeVertexNormals();
      geometry.setAttribute(
        "color",
        new Float32BufferAttribute(
          new Float32Array(source.positions.length).fill(1),
          3,
        ),
      );
      geometry.morphTargetsRelative = true;
      if (source.morphs.length)
        geometry.morphAttributes.position = source.morphs.map((morph) => {
          const values = new Float32Array(source.positions.length);
          morph.vertices.forEach((vertex, i) => {
            values[vertex * 3] = morph.deltas[i * 3];
            values[vertex * 3 + 1] = morph.deltas[i * 3 + 1];
            values[vertex * 3 + 2] = morph.deltas[i * 3 + 2];
          });
          const attr = new Float32BufferAttribute(values, 3);
          attr.name = morph.name;
          return attr;
        });
      if (source.morphs.length) {
        const baseNormals = geometry.getAttribute("normal");
        const morphPositions = geometry.morphAttributes.position;
        if (!morphPositions) throw new Error("Missing position morphs");
        let templates = normalTemplates.get(source);
        if (!templates) {
          templates = morphPositions.map((delta) => {
            const deformed = new BufferGeometry();
            deformed.setIndex(source.indices);
            deformed.setAttribute(
              "position",
              geometry.getAttribute("position").clone(),
            );
            const p = deformed.getAttribute("position");
            for (let i = 0; i < p.count; i++)
              p.setXYZ(
                i,
                p.getX(i) + delta.getX(i),
                p.getY(i) + delta.getY(i),
                p.getZ(i) + delta.getZ(i),
              );
            deformed.computeVertexNormals();
            const normals = deformed.getAttribute("normal");
            const values: number[] = [];
            for (let i = 0; i < p.count; i++)
              values.push(
                normals.getX(i) - baseNormals.getX(i),
                normals.getY(i) - baseNormals.getY(i),
                normals.getZ(i) - baseNormals.getZ(i),
              );
            deformed.dispose();
            const attr = new Float32BufferAttribute(values, 3);
            attr.name = delta.name;
            return attr;
          });
          normalTemplates.set(source, templates);
        }
        geometry.morphAttributes.normal = templates.map((attribute) =>
          attribute.clone(),
        );
      }
      const material = new MeshStandardMaterial({
        vertexColors: true,
        roughness: source.role === "face" ? 0.65 : 0.28,
      });
      const mesh = new Mesh(geometry, material);
      this.parts.push({ source, mesh });
      this.root.add(mesh);
    }
    const skin = this.parts.find((part) => part.source.morphs.length > 0);
    if (!skin)
      throw new Error("Anatomical model is missing facial expression topology");
    this.skin = skin.mesh;
  }

  update(data: RenderData): void {
    const key = JSON.stringify([
      data.dims,
      data.appearance,
      data.currentTheme.colors,
    ]);
    if (key !== this.identityKey) {
      this.identityKey = key;
      const { colors } = data.currentTheme;
      for (const { source, mesh } of this.parts) {
        const skin = source.role === "face";
        const eye = source.role === "leftEye" || source.role === "rightEye";
        const base = new Color(skin ? colors.skin.mid : colors.teeth);
        const materialColors = {
          skin: base,
          teeth: new Color(colors.teeth),
          mouth: new Color(colors.lips.upperDark),
        };
        const surfaceColors: Color[] = [];
        for (const region of source.regions)
          for (const vertex of region.vertices)
            surfaceColors[vertex] = materialColors[region.material];
        const lip = new Color(colors.lips.upper).lerp(base, 0.4);

        const brow = new Color(colors.hair.dark);
        const positions = mesh.geometry.getAttribute("position");
        const vertexColors: number[] = [];
        const cx = source.role === "leftEye" ? -26.32 : 26.32;
        const uv: number[] = [];
        for (let i = 0; i < positions.count; i++) {
          const x = source.positions[i * 3],
            y = source.positions[i * 3 + 1],
            z = source.positions[i * 3 + 2];
          const age = Math.max(0, data.appearance.age - 0.5) * 2;
          const front = Math.max(0, Math.min(1, (z - 20) / 25));
          const nose =
            Math.exp(-((x / 12) ** 2) - ((y + 25) / 23) ** 2) * front;
          const eyeCenterShift = (data.dims.eyeSpacing / 64 - 1) * cx;
          positions.setXYZ(
            i,
            eye
              ? x - cx
              : x * (1 + age * 0.035) +
                  (data.dims.eyeSpacing / 64 - 1) *
                    Math.sign(x) *
                    26.32 *
                    Math.exp(
                      -(((Math.abs(x) - 26.32) / 18) ** 2) -
                        ((y - 3.62) / 18) ** 2,
                    ) *
                    front +
                  (skin ? x * (data.dims.noseWidth / 20 - 1) * nose : 0),
            eye
              ? y - 3.62
              : y -
                  age *
                    1.5 *
                    Math.exp(
                      -(((Math.abs(x) - 35) / 15) ** 2) - ((y + 40) / 23) ** 2,
                    ) *
                    front,
            eye
              ? z - 42.92
              : z +
                  (skin
                    ? (age * 5 + (data.dims.noseHeight / 35 - 1) * 12) * nose
                    : 0),
          );
          if (skin) uv.push(x / 360 + 0.25 + (z < 0 ? 0.5 : 0), y / 220 + 0.5);
          if (eye) {
            uv.push((x - cx) / 30.8 + 0.5, (y - 3.62) / 30.8 + 0.5);
            mesh.position.set(cx + eyeCenterShift, 3.62, 42.92);
          }
          const color = surfaceColors[i].clone();
          if (skin && surfaceColors[i] === base) {
            const mouth =
              Math.exp(-((x / 20) ** 4) - ((y + 51) / 4.5) ** 4) * front;
            color.lerp(lip, mouth * 0.6);
            const browBand =
              Math.exp(
                -(((Math.abs(x) - 26) / 13) ** 4) - ((y - 22) / 2.2) ** 4,
              ) * front;
            color.lerp(brow, browBand * 0.8);
            const shadow =
              Math.exp(-(((Math.abs(x) - 27) / 17) ** 2) - ((y + 3) / 7) ** 2) *
              front;
            color.multiplyScalar(1 - shadow * 0.05 * data.appearance.age);
          }
          vertexColors.push(color.r, color.g, color.b);
        }
        if (eye || skin)
          mesh.geometry.setAttribute("uv", new Float32BufferAttribute(uv, 2));
        if (skin) {
          mesh.material.bumpMap?.dispose();
          mesh.material.bumpMap = createSkinDetail(data.appearance.age);
          mesh.material.bumpScale = 0.5;
        }
        positions.needsUpdate = true;
        mesh.geometry.setAttribute(
          "color",
          new Float32BufferAttribute(vertexColors, 3),
        );
        mesh.material.needsUpdate = true;
        mesh.geometry.computeVertexNormals();
        mesh.geometry.computeBoundingSphere();
      }
      this.root.scale.set(
        data.dims.headWidth / 140,
        data.dims.headHeight / 170,
        data.dims.headWidth / 140,
      );
      this.root.updateMatrixWorld(true);
      this.scalp.geometry.dispose();
      this.scalp.geometry = this.skin.geometry.clone();
      this.scalp.geometry.morphAttributes = {};
      this.scalp.geometry.scale(
        this.root.scale.x,
        this.root.scale.y,
        this.root.scale.z,
      );
      this.scalp.geometry.computeBoundingSphere();
      this.scalpIndex.clear().fromGraphNode(this.scalp);
    }
    const eyeKey = JSON.stringify([
      data.currentTheme.colors,
      data.expression.leftEye.pupilSize,
      data.expression.rightEye.pupilSize,
    ]);
    if (eyeKey !== this.eyeKey) {
      this.eyeKey = eyeKey;
      for (const { source, mesh } of this.parts) {
        if (source.role !== "leftEye" && source.role !== "rightEye") continue;
        const eye =
          source.role === "leftEye"
            ? data.expression.leftEye
            : data.expression.rightEye;
        mesh.material.map?.dispose();
        mesh.material.map = createEyeTexture(
          data.currentTheme.colors,
          eye.pupilSize,
        );
        mesh.material.needsUpdate = true;
      }
    }
    for (const { source, mesh } of this.parts) {
      if (source.role !== "leftEye" && source.role !== "rightEye") continue;
      const eye =
        source.role === "leftEye"
          ? data.expression.leftEye
          : data.expression.rightEye;
      mesh.rotation.set(
        eye.pupilOffset.y * 0.035,
        eye.pupilOffset.x * 0.035,
        0,
      );
    }
    const influences = this.skin.morphTargetInfluences;
    const dictionary = this.skin.morphTargetDictionary;
    if (!influences || !dictionary)
      throw new Error("Anatomical model is missing its expression rig");
    influences.fill(0);
    const set = (name: MorphName, value: number) => {
      const index = dictionary[name];
      if (index === undefined) throw new Error(`Missing facial morph: ${name}`);
      influences[index] = Math.max(0, Math.min(1, value));
    };
    const e = data.expression;
    set("eyeBlink_L", 1 - e.leftEye.openness);
    set("eyeBlink_R", 1 - e.rightEye.openness);
    set("eyeWide_L", e.leftEye.openness - 1);
    set("eyeWide_R", e.rightEye.openness - 1);
    set(
      "eyeSquint_L",
      (e.leftEye.squint + Math.max(0, data.appearance.age - 0.5) * 0.45) *
        e.leftEye.openness,
    );
    set(
      "eyeSquint_R",
      (e.rightEye.squint + Math.max(0, data.appearance.age - 0.5) * 0.45) *
        e.rightEye.openness,
    );
    set(
      "browInnerUp",
      Math.max(e.leftEyebrow.innerY, e.rightEyebrow.innerY) / 12,
    );
    set("browOuterUp_L", e.leftEyebrow.outerY / 12);
    set("browOuterUp_R", e.rightEyebrow.outerY / 12);
    set("browDown_L", -e.leftEyebrow.innerY / 10);
    set("browDown_R", -e.rightEyebrow.innerY / 10);
    set("mouthSmile_L", e.mouth.cornerPull);
    set("mouthSmile_R", e.mouth.cornerPull);
    set("mouthFrown_L", -e.mouth.cornerPull);
    set("mouthFrown_R", -e.mouth.cornerPull);
    set(
      "jawOpen",
      Math.max(0, e.mouth.lowerLipTop - e.mouth.upperLipBottom - 2) / 26,
    );
    set("mouthPucker", Math.max(0, 1 - e.mouth.width));
    set("mouthStretch_L", e.mouth.width - 1);
    set("mouthStretch_R", e.mouth.width - 1);
    set("noseSneer_L", e.noseScrunch);
    set("noseSneer_R", e.noseScrunch);
    set("cheekPuff", e.cheekPuff);
  }

  /** Neutral skin intersections place grooming roots on the actual authored skull. */
  surface(normal: Vector3): Vector3 {
    const center = new Vector3(0, 0, -25);
    this.ray.set(
      center.clone().addScaledVector(normal, 300),
      normal.clone().negate(),
    );
    const hit = this.scalpIndex.rayIntersect(this.ray);
    if (!hit) throw new Error("Grooming ray missed the anatomical scalp");
    return hit.position;
  }

  front(x: number, y: number): Vector3 {
    this.ray.set(new Vector3(x, y, 300), new Vector3(0, 0, -1));
    const hit = this.scalpIndex.rayIntersect(this.ray);
    if (!hit)
      throw new Error("Facial hair root is outside the anatomical face");
    return hit.position;
  }

  dispose(): void {
    this.scalpIndex.clear();
    this.scalp.geometry.dispose();
    this.scalp.material.dispose();
    for (const { mesh } of this.parts) {
      mesh.geometry.dispose();
      mesh.material.map?.dispose();
      mesh.material.bumpMap?.dispose();
      mesh.material.dispose();
    }
  }
}
