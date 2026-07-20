import * as THREE from 'three'
import type { MaterialKey, VoxelModel } from '../voxel/types'
import { createMaterial } from '../voxel/palette'

export class VoxelBatch {
  private readonly entries = new Map<MaterialKey, THREE.Matrix4[]>()
  private readonly geometry = new THREE.BoxGeometry(1, 1, 1)

  add(model: VoxelModel, origin = new THREE.Vector3()): void {
    for (const voxel of model.voxels) {
      const matrices = this.entries.get(voxel.material) ?? []
      const scale = voxel.scale ?? [1, 1, 1]
      matrices.push(new THREE.Matrix4().compose(
        new THREE.Vector3(origin.x + voxel.x, origin.y + voxel.y, origin.z + voxel.z),
        new THREE.Quaternion(),
        new THREE.Vector3(...scale),
      ))
      this.entries.set(voxel.material, matrices)
    }
  }

  commit(scene: THREE.Scene): THREE.InstancedMesh[] {
    return [...this.entries].map(([key, matrices]) => {
      const mesh = new THREE.InstancedMesh(this.geometry, createMaterial(key), matrices.length)
      matrices.forEach((matrix, index) => mesh.setMatrixAt(index, matrix))
      mesh.instanceMatrix.needsUpdate = true
      mesh.castShadow = key !== 'water'
      mesh.receiveShadow = true
      scene.add(mesh)
      return mesh
    })
  }
}
