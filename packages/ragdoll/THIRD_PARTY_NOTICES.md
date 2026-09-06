# Anatomical head

The bundled anatomical head is adapted from the Face Cap model distributed in
[Three.js](https://github.com/mrdoob/three.js/blob/777a4be00245694c971ff4307685795baec9263f/examples/models/gltf/facecap.glb),
commit `777a4be00245694c971ff4307685795baec9263f`. The example credits Face Cap / Bannaflak.
The Three.js MIT license is included at `src/renderers/three/assets/LICENSE.txt`.

The adaptation bakes coordinate transforms, stores sparse facial morph deltas,
removes capture animation and source textures, adds a closed neck base, and labels
skin, mouth, and tooth surface regions. Grooming and surface detail are generated
by Ragdoll. This is an adapted generic head, not a scanned likeness of Einstein.
