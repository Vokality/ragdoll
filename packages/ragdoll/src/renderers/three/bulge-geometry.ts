import { BufferGeometry, Float32BufferAttribute, Vector3 } from "three";

export interface HeadBulgeParams {
  radiusX: number;
  radiusY: number;
  amount: number;
}

/** Ellipsoid that the extruded face is wrapped onto. */
export function headBulgeParams(
  headWidth: number,
  headHeight: number,
): HeadBulgeParams {
  return {
    radiusX: headWidth * 0.56,
    radiusY: headHeight * 0.58,
    amount: headWidth * 0.62,
  };
}

export function surfaceOffsetZ(
  x: number,
  y: number,
  radiusX: number,
  radiusY: number,
  amount: number,
): number {
  if (radiusX <= 0 || radiusY <= 0 || amount === 0) return 0;
  const nx = x / radiusX;
  const ny = y / radiusY;
  const r2 = nx * nx + ny * ny;
  if (r2 >= 1) return 0;
  return Math.sqrt(1 - r2) * amount;
}

/**
 * Split long triangle edges so a later bulge has interior vertices to push.
 * Extruded outline caps are otherwise a flat fan of rim points.
 */
export function subdivideFaces(
  geometry: BufferGeometry,
  maxEdgeLength: number,
  maxPasses = 4,
): BufferGeometry {
  let current = geometry.index ? geometry.toNonIndexed() : geometry.clone();
  if (!current.getAttribute("position")) return current;

  for (let pass = 0; pass < maxPasses; pass += 1) {
    const positions = current.getAttribute("position");
    const next: number[] = [];
    let split = false;
    for (let i = 0; i < positions.count; i += 3) {
      const ax = positions.getX(i);
      const ay = positions.getY(i);
      const az = positions.getZ(i);
      const bx = positions.getX(i + 1);
      const by = positions.getY(i + 1);
      const bz = positions.getZ(i + 1);
      const cx = positions.getX(i + 2);
      const cy = positions.getY(i + 2);
      const cz = positions.getZ(i + 2);
      const ab = Math.hypot(bx - ax, by - ay, bz - az);
      const bc = Math.hypot(cx - bx, cy - by, cz - bz);
      const ca = Math.hypot(ax - cx, ay - cy, az - cz);
      if (
        ab <= maxEdgeLength &&
        bc <= maxEdgeLength &&
        ca <= maxEdgeLength
      ) {
        next.push(ax, ay, az, bx, by, bz, cx, cy, cz);
        continue;
      }
      split = true;
      const abx = (ax + bx) / 2;
      const aby = (ay + by) / 2;
      const abz = (az + bz) / 2;
      const bcx = (bx + cx) / 2;
      const bcy = (by + cy) / 2;
      const bcz = (bz + cz) / 2;
      const cax = (cx + ax) / 2;
      const cay = (cy + ay) / 2;
      const caz = (cz + az) / 2;
      next.push(ax, ay, az, abx, aby, abz, cax, cay, caz);
      next.push(bx, by, bz, bcx, bcy, bcz, abx, aby, abz);
      next.push(cx, cy, cz, cax, cay, caz, bcx, bcy, bcz);
      next.push(abx, aby, abz, bcx, bcy, bcz, cax, cay, caz);
    }
    const subdivided = new BufferGeometry();
    subdivided.setAttribute("position", new Float32BufferAttribute(next, 3));
    if (current !== geometry) current.dispose();
    current = subdivided;
    if (!split) break;
  }
  return current;
}

/** Weld coincident vertices so the rounded cap shades smoothly. */
export function weldVertices(
  geometry: BufferGeometry,
  tolerance = 0.04,
): BufferGeometry {
  const positions = geometry.getAttribute("position");
  if (!positions) return geometry;
  const quant = 1 / tolerance;
  const index: number[] = [];
  const vertices: number[] = [];
  const map = new Map<string, number>();
  for (let i = 0; i < positions.count; i += 1) {
    const x = positions.getX(i);
    const y = positions.getY(i);
    const z = positions.getZ(i);
    const key = `${Math.round(x * quant)}:${Math.round(y * quant)}:${Math.round(z * quant)}`;
    let idx = map.get(key);
    if (idx === undefined) {
      idx = vertices.length / 3;
      map.set(key, idx);
      vertices.push(x, y, z);
    }
    index.push(idx);
  }
  const welded = new BufferGeometry();
  welded.setAttribute("position", new Float32BufferAttribute(vertices, 3));
  welded.setIndex(index);
  welded.computeVertexNormals();
  return welded;
}

/**
 * Tessellate, bulge, and weld an extruded outline so it reads as a rounded volume.
 */
export function roundExtrudedOutline(
  geometry: BufferGeometry,
  radiusX: number,
  radiusY: number,
  amount: number,
  maxEdgeLength = 10,
): BufferGeometry {
  const subdivided = subdivideFaces(geometry, maxEdgeLength);
  bulgeFront(subdivided, radiusX, radiusY, amount);
  const welded = weldVertices(subdivided);
  if (welded !== subdivided) subdivided.dispose();
  return welded;
}

/**
 * Push the front of an extruded outline onto an ellipsoid so a face slab
 * reads as a rounded head instead of a cookie-cutter.
 */
export function bulgeFront(
  geometry: BufferGeometry,
  radiusX: number,
  radiusY: number,
  amount: number,
): void {
  const positions = geometry.getAttribute("position");
  if (!positions || amount === 0) return;
  const vertex = new Vector3();
  for (let i = 0; i < positions.count; i += 1) {
    vertex.fromBufferAttribute(positions, i);
    const bulge = surfaceOffsetZ(vertex.x, vertex.y, radiusX, radiusY, amount);
    if (bulge === 0) continue;
    const frontness = vertex.z >= 0 ? 1 : 0.22;
    positions.setXYZ(i, vertex.x, vertex.y, vertex.z + bulge * frontness);
  }
  positions.needsUpdate = true;
  geometry.computeVertexNormals();
}

/**
 * Replace faceted tessellation normals on the front cap with the ellipsoid
 * gradient so the head shades like a smooth volume.
 */
export function applyEllipsoidNormals(
  geometry: BufferGeometry,
  radiusX: number,
  radiusY: number,
  amount: number,
): void {
  const positions = geometry.getAttribute("position");
  if (!positions || amount === 0) return;
  geometry.computeVertexNormals();
  const normals = geometry.getAttribute("normal");
  if (!normals) return;
  const rx2 = radiusX * radiusX;
  const ry2 = radiusY * radiusY;
  const az2 = amount * amount;
  const vertex = new Vector3();
  const normal = new Vector3();
  for (let i = 0; i < positions.count; i += 1) {
    vertex.fromBufferAttribute(positions, i);
    const bulge = surfaceOffsetZ(vertex.x, vertex.y, radiusX, radiusY, amount);
    if (bulge <= 1) continue;
    normal.set(vertex.x / rx2, vertex.y / ry2, bulge / az2).normalize();
    if (vertex.z < bulge * 0.5) {
      normal.z = -Math.abs(normal.z);
      normal.normalize();
    }
    normals.setXYZ(i, normal.x, normal.y, normal.z);
  }
  normals.needsUpdate = true;
}

/** Translate a feature so its centroid sits on the head ellipsoid. */
export function liftToHeadSurface(
  geometry: BufferGeometry,
  radiusX: number,
  radiusY: number,
  amount: number,
  extra = 0,
): void {
  geometry.computeBoundingBox();
  const box = geometry.boundingBox;
  if (!box) return;
  const cx = (box.min.x + box.max.x) / 2;
  const cy = (box.min.y + box.max.y) / 2;
  geometry.translate(
    0,
    0,
    surfaceOffsetZ(cx, cy, radiusX, radiusY, amount) + extra,
  );
}
