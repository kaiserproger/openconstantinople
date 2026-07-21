import * as THREE from 'three'
import type { MaterialKey } from './types'

const MATERIAL_COLORS: Record<MaterialKey, number> = {
  earth: 0x715637,
  grass: 0x667341,
  water: 0x173d55,
  marble: 0xd8cfb8,
  brick: 0x9b4c36,
  roof: 0x8a392e,
  timber: 0x66452d,
  gold: 0xd3aa55,
  porphyry: 0x5a2d72,
  iron: 0x3b3a3d,
  foliage: 0x49582f,
  fire: 0xe67832,
}

export function materialColor(key: MaterialKey): number {
  return MATERIAL_COLORS[key]
}

export function createMaterial(key: MaterialKey): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color: MATERIAL_COLORS[key],
    flatShading: true,
    roughness: key === 'gold' || key === 'iron' ? 0.58 : key === 'water' ? 0.42 : 0.88,
    metalness: key === 'gold' ? 0.52 : key === 'iron' ? 0.32 : 0,
    emissive: key === 'water' ? 0x0b2638 : key === 'porphyry' ? 0x1d082b : 0x000000,
    emissiveIntensity: key === 'water' ? 1.35 : key === 'porphyry' ? 0.8 : 0,
    transparent: key === 'water',
    opacity: key === 'water' ? 0.86 : 1,
  })
}
