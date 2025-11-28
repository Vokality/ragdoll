import * as THREE from 'three';
import { RagdollSkeleton } from './ragdoll-skeleton';

interface FacialMeshes {
  head: THREE.Mesh;
  facePlate: THREE.Mesh;
  mouth: THREE.Mesh;
  mouthInterior: THREE.Mesh;
  tongue: THREE.Mesh;
  nose: THREE.Mesh;
  teeth: THREE.Mesh;
  leftEye: THREE.Mesh;
  rightEye: THREE.Mesh;
  leftEyeWhite: THREE.Mesh;
  rightEyeWhite: THREE.Mesh;
  leftEyebrow: THREE.Mesh;
  rightEyebrow: THREE.Mesh;
  leftEyelid: THREE.Mesh;
  rightEyelid: THREE.Mesh;
}

export class RagdollGeometry {
  private skeleton: RagdollSkeleton;
  public group: THREE.Group;
  public facialMeshes: FacialMeshes;

  private materials = {
    skin: new THREE.MeshStandardMaterial({
      color: 0xffcba4,
      roughness: 0.5,
      metalness: 0.0,
    }),
    hair: new THREE.MeshStandardMaterial({
      color: 0x3d2817,
      roughness: 0.3,
      metalness: 0.2,
    }),
    eyeWhite: new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.3,
      metalness: 0.0,
    }),
    eyePupil: new THREE.MeshStandardMaterial({
      color: 0x1e5f8c,
      roughness: 0.2,
      metalness: 0.0,
    }),
    eyebrow: new THREE.MeshStandardMaterial({
      color: 0x2d1f14,
      roughness: 0.8,
      metalness: 0.0,
    }),
    mouth: new THREE.MeshStandardMaterial({
      color: 0xd94f70,
      roughness: 0.4,
      metalness: 0.0,
    }),
    teeth: new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.2,
      metalness: 0.0,
    }),
    cheeks: new THREE.MeshStandardMaterial({
      color: 0xff9999,
      roughness: 0.6,
      metalness: 0.0,
      transparent: true,
      opacity: 0.7,
    }),
    facePlate: new THREE.MeshStandardMaterial({
      color: 0xffe5d1,
      roughness: 0.45,
      metalness: 0.0,
    }),
    iris: new THREE.MeshStandardMaterial({
      color: 0x2f68ff,
      roughness: 0.25,
      metalness: 0.0,
    }),
    eyeHighlight: new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.05,
      metalness: 0.0,
      transparent: true,
      opacity: 0.85,
    }),
    mouthInterior: new THREE.MeshStandardMaterial({
      color: 0x641b1b,
      roughness: 0.55,
      metalness: 0.0,
    }),
    tongue: new THREE.MeshStandardMaterial({
      color: 0xff7a8a,
      roughness: 0.4,
      metalness: 0.0,
    }),
    eyelid: new THREE.MeshStandardMaterial({
      color: 0xf7c6a5,
      roughness: 0.65,
      metalness: 0.0,
      transparent: true,
      opacity: 0.95,
    }),
  };

  constructor(skeleton: RagdollSkeleton) {
    this.skeleton = skeleton;
    this.group = new THREE.Group();
    this.facialMeshes = {} as FacialMeshes;
    this.buildCharacter();
  }

  private buildCharacter(): void {
    const bones = this.skeleton.getBones();
    const boneMap = new Map<string, THREE.Bone>();
    bones.forEach((bone) => boneMap.set(bone.name, bone));

    const headPivot = boneMap.get('headPivot');
    if (headPivot) {
      this.createFloatingStem(headPivot);
    }

    const neckBone = boneMap.get('neck');
    const headBone = boneMap.get('head');

    if (neckBone && headBone) {
      this.createHead(neckBone, headBone);
    }
  }

  private createFloatingStem(pivot: THREE.Bone): void {
    const stemGeometry = new THREE.CylinderGeometry(0.05, 0.06, 0.35, 24);
    const stemMaterial = new THREE.MeshStandardMaterial({
      color: 0x33363f,
      roughness: 0.65,
      metalness: 0.15,
    });
    const stem = new THREE.Mesh(stemGeometry, stemMaterial);
    stem.position.y = -0.18;
    stem.castShadow = true;
    pivot.add(stem);

    const baseGeometry = new THREE.SphereGeometry(0.1, 32, 32);
    const base = new THREE.Mesh(baseGeometry, stemMaterial);
    base.position.y = -0.38;
    base.scale.set(1.6, 0.5, 1.6);
    base.castShadow = true;
    pivot.add(base);
  }

  private createHead(neckBone: THREE.Bone, headBone: THREE.Bone): void {
    const neckLength = 0.12;
    const neckGeometry = new THREE.CylinderGeometry(0.05, 0.055, neckLength, 16);
    const neck = new THREE.Mesh(neckGeometry, this.materials.skin);
    neck.position.y = neckLength / 2;
    neck.castShadow = true;
    neckBone.add(neck);

    const neckBaseGeometry = new THREE.SphereGeometry(0.055, 16, 16);
    const neckBase = new THREE.Mesh(neckBaseGeometry, this.materials.skin);
    neckBase.castShadow = true;
    neckBone.add(neckBase);

    // More human-like head shape: flattened face, rounded back
    const headGeometry = new THREE.SphereGeometry(0.18, 32, 32);
    const head = new THREE.Mesh(headGeometry, this.materials.skin);
    head.scale.set(0.9, 1.05, 0.85); // Narrower width, taller, flatter front-to-back
    head.castShadow = true;
    this.facialMeshes.head = head;

    // Properly sized eyes with iris detail
    const eyeWhiteGeometry = new THREE.SphereGeometry(0.025, 20, 20);

    const leftEyeWhite = new THREE.Mesh(eyeWhiteGeometry, this.materials.eyeWhite);
    leftEyeWhite.position.set(0.05, 0.05, 0.15);
    leftEyeWhite.scale.set(1.1, 1, 0.5); // Slightly flattened
    leftEyeWhite.castShadow = true;

    // Iris (colored part)
    const irisGeometry = new THREE.CircleGeometry(0.012, 32);
    const leftIris = new THREE.Mesh(irisGeometry, this.materials.eyePupil);
    leftIris.position.set(0.05, 0.05, 0.163);
    leftIris.castShadow = true;

    // Pupil (black center)
    const pupilGeometry = new THREE.CircleGeometry(0.006, 24);
    const pupilMaterial = new THREE.MeshStandardMaterial({
      color: 0x000000,
      roughness: 0.1,
      metalness: 0.0,
    });
    const leftPupil = new THREE.Mesh(pupilGeometry, pupilMaterial);
    leftPupil.position.set(0.05, 0.05, 0.164);
    leftPupil.castShadow = true;
    this.facialMeshes.leftEye = leftPupil;

    const rightEyeWhite = new THREE.Mesh(eyeWhiteGeometry, this.materials.eyeWhite);
    rightEyeWhite.position.set(-0.05, 0.05, 0.15);
    rightEyeWhite.scale.set(1.1, 1, 0.5);
    rightEyeWhite.castShadow = true;

    const rightIris = new THREE.Mesh(irisGeometry, this.materials.eyePupil);
    rightIris.position.set(-0.05, 0.05, 0.163);
    rightIris.castShadow = true;

    const rightPupil = new THREE.Mesh(pupilGeometry, pupilMaterial);
    rightPupil.position.set(-0.05, 0.05, 0.164);
    rightPupil.castShadow = true;
    this.facialMeshes.rightEye = rightPupil;

    const eyebrowGeometry = new THREE.BoxGeometry(0.04, 0.008, 0.008);

    const leftEyebrow = new THREE.Mesh(eyebrowGeometry, this.materials.eyebrow);
    leftEyebrow.position.set(0.05, 0.08, 0.16);
    leftEyebrow.rotation.z = -0.1;
    this.facialMeshes.leftEyebrow = leftEyebrow;

    const rightEyebrow = new THREE.Mesh(eyebrowGeometry, this.materials.eyebrow);
    rightEyebrow.position.set(-0.05, 0.08, 0.16);
    rightEyebrow.rotation.z = 0.1;
    this.facialMeshes.rightEyebrow = rightEyebrow;

    // No permanent eyelids - they were causing visual issues
    // Eyes are naturally framed by the eyebrows and eye geometry itself

    // Animated wink eyelids (hidden by default, cover eye when winking)
    const winkEyelidGeometry = new THREE.PlaneGeometry(0.06, 0.05);

    const leftEyelid = new THREE.Mesh(winkEyelidGeometry, this.materials.eyelid);
    leftEyelid.position.set(0.05, 0.072, 0.165);
    leftEyelid.rotation.y = -0.02;
    leftEyelid.visible = false;
    leftEyelid.userData.basePosition = leftEyelid.position.clone();
    leftEyelid.userData.baseScale = leftEyelid.scale.clone();
    this.facialMeshes.leftEyelid = leftEyelid;

    const rightEyelid = new THREE.Mesh(winkEyelidGeometry.clone(), this.materials.eyelid);
    rightEyelid.position.set(-0.05, 0.072, 0.165);
    rightEyelid.rotation.y = 0.02;
    rightEyelid.visible = false;
    rightEyelid.userData.basePosition = rightEyelid.position.clone();
    rightEyelid.userData.baseScale = rightEyelid.scale.clone();
    this.facialMeshes.rightEyelid = rightEyelid;

    const noseGeometry = new THREE.SphereGeometry(0.015, 12, 12);
    const nose = new THREE.Mesh(noseGeometry, this.materials.skin);
    nose.position.set(0, 0.01, 0.18);
    nose.castShadow = true;
    this.facialMeshes.nose = nose;

    // Simple mouth
    const mouthCurve = new THREE.TorusGeometry(0.035, 0.01, 8, 16, Math.PI);
    const mouth = new THREE.Mesh(mouthCurve, this.materials.mouth);
    mouth.position.set(0, -0.05, 0.16);
    mouth.rotation.x = Math.PI;
    mouth.rotation.z = Math.PI;
    mouth.castShadow = true;
    this.facialMeshes.mouth = mouth;

    // Teeth (simple, subtle)
    const teethGeometry = new THREE.BoxGeometry(0.04, 0.012, 0.008);
    const teeth = new THREE.Mesh(teethGeometry, this.materials.teeth);
    teeth.position.set(0, -0.048, 0.155);
    this.facialMeshes.teeth = teeth;

    const cheekGeometry = new THREE.SphereGeometry(0.018, 16, 16);

    const leftCheek = new THREE.Mesh(cheekGeometry, this.materials.cheeks);
    leftCheek.position.set(0.08, -0.01, 0.14);
    leftCheek.scale.set(1, 0.8, 0.4);

    const rightCheek = new THREE.Mesh(cheekGeometry, this.materials.cheeks);
    rightCheek.position.set(-0.08, -0.01, 0.14);
    rightCheek.scale.set(1, 0.8, 0.4);

    this.createHair(headBone);

    const headGroup = new THREE.Group();
    headGroup.add(head);
    headGroup.add(leftEyeWhite);
    headGroup.add(leftIris);
    headGroup.add(leftPupil);
    headGroup.add(rightEyeWhite);
    headGroup.add(rightIris);
    headGroup.add(rightPupil);
    headGroup.add(leftEyebrow);
    headGroup.add(rightEyebrow);
    headGroup.add(nose);
    headGroup.add(mouth);
    headGroup.add(teeth);
    headGroup.add(leftCheek);
    headGroup.add(rightCheek);
    headGroup.add(leftEyelid);
    headGroup.add(rightEyelid);

    headBone.add(headGroup);
    this.group.add(this.skeleton.skeleton.root);
  }

  private createHair(headBone: THREE.Bone): void {
    const hairGroup = new THREE.Group();

    const hairCapGeometry = new THREE.SphereGeometry(
      0.19,
      32,
      32,
      0,
      Math.PI * 2,
      0,
      Math.PI / 2
    );
    const hairCap = new THREE.Mesh(hairCapGeometry, this.materials.hair);
    hairCap.position.y = 0.05;
    hairCap.castShadow = true;
    hairGroup.add(hairCap);

    const spikeGeometry = new THREE.ConeGeometry(0.03, 0.1, 8);
    const positions = [
      { x: 0, z: 0 },
      { x: 0.06, z: 0.06 },
      { x: -0.06, z: 0.06 },
      { x: 0.08, z: -0.02 },
      { x: -0.08, z: -0.02 },
    ];

    positions.forEach((pos) => {
      const spike = new THREE.Mesh(spikeGeometry, this.materials.hair);
      spike.position.set(pos.x, 0.18, pos.z);
      spike.rotation.x = Math.random() * 0.2 - 0.1;
      spike.rotation.z = Math.random() * 0.2 - 0.1;
      spike.castShadow = true;
      hairGroup.add(spike);
    });

    headBone.add(hairGroup);
  }

  public getGroup(): THREE.Group {
    return this.group;
  }
}
