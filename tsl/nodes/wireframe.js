import { attribute, fwidth, smoothstep, min, select, vec4, vec3, frontFacing, Fn } from "three/tsl"

export default Fn(([thickness])=>{
  const vCenter = attribute('center', 'vec3')
  const afwidth = fwidth(vCenter)
  const edge3 = smoothstep(thickness.sub(1.0).mul(afwidth), thickness.mul(afwidth), vCenter)
  const edge = min(min(edge3.x, edge3.y), edge3.z).oneMinus()
  const alpha = select(frontFacing, edge, 0.1)
  return vec4(vec3(edge), alpha)
})