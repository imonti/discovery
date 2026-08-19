import * as THREE from "three";
import { pane } from "./config.js";
import {
  Fn,
  uniform,
  varying,
  uv,
  smoothstep,
  abs,
  fract,
  mix,
  linearDepth,
  vec4,
  vec2,
  mul,
  max,
  fwidth,
} from "three/tsl";
import { MeshBasicNodeMaterial } from "three/webgpu";

const paneState = {
  grid: {
    fadeoff: 0.75,
    line: {
      scale: 10,
      thickness: 0.005,
      color: "#5c5a71",
      offset: { x: 0.0, y: 0.0 },
    },
    cross: {
      scale: 50,
      thickness: 0.05,
      color: "#6059AC",
      size: 0.2,
      offset: { x: 0.5, y: 0.5 },
    },
  },
};

class Grid extends THREE.Group {
  constructor() {
    super();

    const uFadeoffThreshold = uniform(paneState.grid.fadeoff);
    const uCrossColor = uniform(new THREE.Color(paneState.grid.cross.color));
    const uCrossThickness = uniform(paneState.grid.cross.thickness);
    const uCrossSize = uniform(paneState.grid.cross.size);
    const uCrossGridScale = uniform(paneState.grid.cross.scale);
    const uCrossGridOffset = uniform(
      new THREE.Vector2(
        paneState.grid.cross.offset.x,
        paneState.grid.cross.offset.y,
      ),
    );
    const vCrossGridUV = varying(
      uv().mul(uCrossGridScale.mul(2)).add(uCrossGridOffset),
    );

    const lineGridNode = Fn(() => {
      const uvDeriv = fwidth(vLineGridUV);
      // --- NOTE ----
      // remember that the UV derivative can be *roughly* interpreted as the amount of UV units that the current pixel holds
      // a dFdx(uv.x) of 0.01 means that the current pixel holds 0.01 uvs range.
      // --------------
      // force the line thickness never to be below uvDeriv. That is to say, no less than 1 px.
      const drawWidth = max(uLineThickness, uvDeriv);
      // compute how different the line thickness is from the thickness we wanted it to be.
      // this will only make sense when the line thickness becomes smaller than the actual draw width
      const discrepancyRatio = uLineThickness.div(drawWidth);
      const dd = drawWidth.div(uLineThickness);
      const lineAA = uvDeriv.mul(1.5);
      let gridUV = abs(fract(vLineGridUV).mul(2.0).sub(1.0));
      let gridAA = smoothstep(
        drawWidth.add(lineAA),
        drawWidth.sub(lineAA),
        gridUV,
      );
      // saturate is there to keep the discrepancy ratio clamped between 0 and 1 so that it's at most as bright as 1 but as little as dark as 0
      // let grid2 = gridAA.mul(saturate(discrepancyRatio));
      // merge both grids (if this is confusing, consult the sketch on aa_studies_02)
      const grid = mix(gridAA.x, 1.0, gridAA.y);
      // perform a final mix to decide which color should be rendered
      let finalColor = mix(vec4(0.0), uLineColor, grid);
      return finalColor;
    });

    const crossGridNode = Fn(() => {
      const _uv = abs(fract(vCrossGridUV).mul(2.0).sub(1.0));
      let aa = fwidth(vCrossGridUV).mul(1.5);
      // cross config
      const cross = vec2(uCrossThickness, uCrossSize);
      // horizontal strip
      const hs = smoothstep(cross.sub(aa), cross.add(aa), _uv);
      const hf = mix(hs.x, 1.0, hs.y);
      // vertical strip
      const vs = smoothstep(cross.yx.sub(aa), cross.yx.add(aa), _uv);
      const vf = mix(vs.x, 1.0, vs.y);
      // combine strips
      const factor = mul(hf, vf);
      return mix(uCrossColor, vec4(0.0), factor);
    });

    const gridPlaneGeometry = new THREE.PlaneGeometry(100, 100);
    const gridMaterial = new MeshBasicNodeMaterial();
    gridMaterial.side = THREE.DoubleSide;
    gridMaterial.transparent = true;
    const uLineColor = uniform(new THREE.Color(paneState.grid.line.color));
    const uLineThickness = uniform(paneState.grid.line.thickness);
    const uLineGridScale = uniform(paneState.grid.line.scale);
    const uLineGridOffset = uniform(
      new THREE.Vector2(
        paneState.grid.line.offset.x,
        paneState.grid.line.offset.y,
      ),
    );
    const vLineGridUV = varying(uv().mul(uLineGridScale).add(uLineGridOffset));

    gridMaterial.colorNode = Fn(() => {
      const cross = crossGridNode();
      const line = lineGridNode();
      // compute fadeoff alpha
      const fadeoff = smoothstep(
        0.0,
        uFadeoffThreshold,
        linearDepth(),
      ).oneMinus();
      return cross.add(line).mul(vec4(1.0, 1.0, 1.0, fadeoff));
    })();

    const grid = new THREE.Mesh(gridPlaneGeometry, gridMaterial);
    grid.applyMatrix4(
      new THREE.Matrix4().makeRotationAxis(
        new THREE.Vector3(1.0, 0.0, 0.0),
        Math.PI * 0.5,
      ),
    );

    this.add(grid);
  }
}

export { Grid };
