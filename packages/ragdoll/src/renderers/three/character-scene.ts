import {
  ACESFilmicToneMapping,
  BufferGeometry,
  DirectionalLight,
  Group,
  HemisphereLight,
  Mesh,
  MeshStandardMaterial,
  PerspectiveCamera,
  Scene,
  WebGLRenderer,
} from "three";
import type { RenderData } from "../../components/render-data";
import { AnatomicalHead } from "./anatomical-head";
import {
  createGroomGeometry,
  createHairCapGeometry,
  type GroomSurface,
} from "./groom-geometry";

export class CharacterScene {
  private readonly renderer: WebGLRenderer;
  private readonly scene = new Scene();
  private readonly camera = new PerspectiveCamera(30, 320 / 380, 1, 2000);
  private readonly head = new Group();
  private readonly anatomy = new AnatomicalHead();
  private readonly groomMaterial = new MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.8,
  });
  private readonly groom = new Mesh(new BufferGeometry(), this.groomMaterial);
  private readonly hairCap = new Mesh(new BufferGeometry(), this.groomMaterial);
  private readonly surface: GroomSurface = {
    scalp: (normal) => this.anatomy.surface(normal),
    front: (x, y) => this.anatomy.front(x, y),
  };
  private groomKey = "";

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true });
    this.renderer.setClearColor(0, 0);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.toneMapping = ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.camera.position.set(0, 0, 570);
    this.camera.lookAt(0, 0, 0);
    const key = new DirectionalLight(0xfff4ea, 2.7);
    key.position.set(-180, 160, 300);
    const fill = new DirectionalLight(0xcbdfff, 0.85);
    fill.position.set(200, 20, 200);
    const rim = new DirectionalLight(0xffffff, 1.5);
    rim.position.set(40, 180, -200);
    this.scene.add(
      new HemisphereLight(0xffffff, 0x777080, 1.15),
      key,
      fill,
      rim,
      this.head,
    );
    this.head.add(this.anatomy.root, this.groom, this.hairCap);
  }
  setSize(width: number, height: number): void {
    if (width <= 0 || height <= 0) return;
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.render(this.scene, this.camera);
  }
  setData(data: RenderData): void {
    this.head.rotation.set(0, 0, 0);
    this.head.position.set(0, 0, 0);
    this.head.scale.setScalar(1);
    this.head.updateMatrixWorld(true);
    this.anatomy.update(data);
    const key = JSON.stringify([
      data.dims,
      data.appearance,
      data.currentTheme.colors.hair,
    ]);
    if (key !== this.groomKey) {
      this.groomKey = key;
      this.groom.geometry.dispose();
      this.groom.geometry = createGroomGeometry(data, this.surface);
      this.hairCap.geometry.dispose();
      this.hairCap.geometry = createHairCapGeometry(data, this.surface);
    }
    this.head.rotation.set(data.pitch, data.yaw, -data.headRoll);
    this.head.position.y = -data.breathingOffsetY;
    this.head.scale.setScalar(data.breathingScale);
    this.renderer.render(this.scene, this.camera);
  }
  dispose(): void {
    this.anatomy.dispose();
    this.groom.geometry.dispose();
    this.hairCap.geometry.dispose();
    this.groomMaterial.dispose();
    this.renderer.dispose();
  }
}
