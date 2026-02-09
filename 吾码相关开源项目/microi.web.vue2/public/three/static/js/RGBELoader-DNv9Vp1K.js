import{Q as ae}from"./main-DrxgF003.js";import{W as ce,ay as pe,K as me,U as se,av as P,az as X,ae as T,au as B,aA as w,aB as ee,aa as ge,C as F,aC as ve,D as le,aD as _e,M as te,V as k,aE as de,aF as xe,aG as Me,aH as Se,aI as Te,aJ as be,aK as Ce,ah as we,aL as ye,aM as De,aN as Ee,y as Be,Q as Pe,O as Re,aO as Le,aP as J,aQ as Z,aR as Ae,L as ne}from"./DRACOLoader-DSa8Sn_h.js";const Qe=["#ff4500","#ff8c00","#ffd700","#90ee90","#00ced1","#1e90ff","#c71585","rgba(255, 69, 0, 0.68)","rgb(255, 120, 0)","hsv(51, 100, 98)","hsva(120, 40, 94, 0.5)","hsl(181, 100%, 37%)","hsla(209, 100%, 56%, 0.73)","#c7158577"],We=`
     varying vec2 vUv;
	 void main() {
		vUv = uv;
		gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
	 }
`,Xe=`
		uniform sampler2D baseTexture;
		uniform sampler2D bloomTexture;
		uniform vec3 glowColor; 

		varying vec2 vUv;

		void main() {
			vec4 baseColor = texture2D(baseTexture, vUv);
			vec4 bloomColor = texture2D(bloomTexture, vUv);

			// 调整辉光颜色
			vec4 glow = vec4(glowColor, 1.0);

			gl_FragColor = baseColor + glow * bloomColor;
		}`,Ye={transformers_1:{Mesh_0311_Tex_0310_0dds_0:{x:0,y:"straight",z:0},Mesh_0314_Tex_0313_0dds_0:{x:"straight",y:"burden",z:"burden"},Mesh_0317_Tex_0313_0dd1_0:{x:0,y:0,z:0},Mesh_0317001_Tex_0313_0dd1_0:{x:0,y:"burden",z:0},Mesh_0317002_Tex_0313_0dd1_0:{x:"straight",y:"burden",z:"straight"},Mesh_0311001_Tex_0310_0dds_0:{x:"straight",y:"straight",z:0},Mesh_0317003_Tex_0313_0dd1_0:{x:"straight",y:"straight",z:"burden"},Mesh_0317004_Tex_0313_0dd1_0:{x:"straight",y:0,z:"burden"},Mesh_0317005_Tex_0313_0dd1_0:{x:0,y:0,z:0},Mesh_0317006_Tex_0313_0dd1_0:{x:"straight",y:"straight",z:0},Mesh_0317007_Tex_0313_0dd1_0:{x:"straight",y:0,z:"burden"},Mesh_0314001_Tex_0313_0dds_0:{x:"burden",y:"burden",z:"burden"},Mesh_0317008_Tex_0313_0dd1_0:{x:"burden",y:"burden",z:"straight"},Mesh_0311002_Tex_0310_0dds_0:{x:"burden",y:"straight",z:0},Mesh_0317009_Tex_0313_0dd1_0:{x:"burden",y:"straight",z:"burden"},Mesh_0317010_Tex_0313_0dd1_0:{x:"burden",y:0,z:"burden"},Mesh_0317011_Tex_0313_0dd1_0:{x:"burden",y:"straight",z:0},Mesh_0317012_Tex_0313_0dd1_0:{x:"burden",y:0,z:"burden"}},transformers_3:{Mesh_0254_Tex_0253_0dds_0:{x:"straight",y:0,z:0},Mesh_0258_Tex_0253_0dd1_0:{x:"straight",y:0,z:0},Mesh_0260_Tex_0253_0dd2_0:{x:0,y:"straight",z:0},Mesh_0272_Tex_0271_0dds_0:{x:"straight",y:0,z:"burden"},Mesh_0275_Tex_0271_0dd1_0:{x:0,y:0,z:0},Mesh_0275001_Tex_0271_0dd1_0:{x:"straight",y:0,z:"burden"},Mesh_0275002_Tex_0271_0dd1_0:{x:0,y:"straight",z:"burden"},Mesh_0275003_Tex_0271_0dd1_0:{x:0,y:"straight",z:"straight"},Mesh_0272001_Tex_0271_0dds_0:{x:0,y:"burden",z:0},Mesh_0254001_Tex_0253_0dds_0:{x:"burden",y:0,z:0},Mesh_0272002_Tex_0271_0dds_0:{x:"burden",y:0,z:"burden"},Mesh_0275004_Tex_0271_0dd1_0:{x:"burden",y:0,z:"burden"},Mesh_0275005_Tex_0271_0dd1_0:{x:0,y:"straight",z:"burden"},Mesh_0275006_Tex_0271_0dd1_0:{x:0,y:"straight",z:"straight"},Mesh_0272003_Tex_0271_0dds_0:{x:0,y:"burden",z:0},Mesh_0258001_Tex_0253_0dd1_0:{x:"burden",y:0,z:0}}},je="MODEL_PREVIEW_CONFIG",$e="MODEL_BASE_DATA",Ze="MODEL_BASE_DRAGS_DATA",Ke="update-model",qe="page-loading",Je={background:{visible:!0,type:3,image:ae[0].cover,viewImg:ae[0].url,color:"#000"},material:{meshList:[]},animation:{visible:!0,animationName:null,loop:"LoopRepeat",timeScale:1,weight:1},attribute:{visible:!0,gridHelper:!1,x:0,y:0,z:0,positionX:0,positionY:0,positionZ:0,divisions:10,size:4,color:"rgb(193,193,193)",axesHelper:!1,axesSize:1.8,rotationX:0,rotationY:0,rotationZ:0},light:{planeGeometry:!1,planeColor:"#939393",planeWidth:7,planeHeight:7,ambientLight:!0,ambientLightColor:"#fff",ambientLightIntensity:1,directionalLight:!1,directionalLightHelper:!0,directionalLightColor:"#1E90FF",directionalLightIntensity:1,directionalHorizontal:-1.26,directionalVertical:-3.85,directionalSistine:2.98,directionShadow:!0,pointLight:!1,pointLightHelper:!0,pointLightColor:"#1E90FF",pointLightIntensity:1,pointHorizontal:-4.21,pointVertical:-4.1,pointDistance:2.53,spotLight:!1,spotLightColor:"#323636",spotLightIntensity:400,spotHorizontal:-3.49,spotVertical:-4.37,spotSistine:4.09,spotAngle:.5,spotPenumbra:1,spotFocus:1,spotCastShadow:!0,spotLightHelper:!0,spotDistance:20},stage:{meshPositionList:[],glow:!1,threshold:.05,strength:.6,radius:1,decompose:0,transformType:"translate",toneMappingExposure:1,hoverMeshTag:!1},camera:{x:0,y:2,z:6}},et="/three/modelIframe?modelIframe",tt=[{type:"",describe:"默认材质",color:!0,wireframe:!0,depthWrite:!0,opacity:!0},{type:"MeshBasicMaterial",describe:"基础网格材质",color:!0,wireframe:!0,depthWrite:!0,opacity:!0},{type:"MeshLambertMaterial",describe:"Lambert网格材质",color:!0,wireframe:!0,depthWrite:!0,opacity:!0},{type:"MeshMatcapMaterial",describe:"MeshMatcap材质",color:!0,wireframe:!1,depthWrite:!0,opacity:!0},{type:"MeshPhongMaterial",describe:"Phong网格材质",color:!0,wireframe:!0,depthWrite:!0,opacity:!0},{type:"MeshPhysicalMaterial",describe:"物理网格材质",color:!0,wireframe:!0,depthWrite:!0,opacity:!0},{type:"MeshStandardMaterial",describe:"标准网格材质",color:!0,wireframe:!0,depthWrite:!0,opacity:!0},{type:"MeshToonMaterial",describe:"卡通着色的材质",color:!0,wireframe:!0,depthWrite:!0,opacity:!0}],W={name:"CopyShader",uniforms:{tDiffuse:{value:null},opacity:{value:1}},vertexShader:`

		varying vec2 vUv;

		void main() {

			vUv = uv;
			gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );

		}`,fragmentShader:`

		uniform float opacity;

		uniform sampler2D tDiffuse;

		varying vec2 vUv;

		void main() {

			vec4 texel = texture2D( tDiffuse, vUv );
			gl_FragColor = opacity * texel;


		}`};class N{constructor(){this.isPass=!0,this.enabled=!0,this.needsSwap=!0,this.clear=!1,this.renderToScreen=!1}setSize(){}render(){console.error("THREE.Pass: .render() must be implemented in derived pass.")}dispose(){}}const ze=new pe(-1,1,1,-1,0,1);class Ue extends me{constructor(){super(),this.setAttribute("position",new se([-1,3,0,-1,-1,0,3,-1,0],3)),this.setAttribute("uv",new se([0,2,0,0,2,0],2))}}const Oe=new Ue;class q{constructor(e){this._mesh=new ce(Oe,e)}dispose(){this._mesh.geometry.dispose()}render(e){e.render(this._mesh,ze)}get material(){return this._mesh.material}set material(e){this._mesh.material=e}}class Fe extends N{constructor(e,a="tDiffuse"){super(),this.textureID=a,this.uniforms=null,this.material=null,e instanceof P?(this.uniforms=e.uniforms,this.material=e):e&&(this.uniforms=X.clone(e.uniforms),this.material=new P({name:e.name!==void 0?e.name:"unspecified",defines:Object.assign({},e.defines),uniforms:this.uniforms,vertexShader:e.vertexShader,fragmentShader:e.fragmentShader})),this._fsQuad=new q(this.material)}render(e,a,r){this.uniforms[this.textureID]&&(this.uniforms[this.textureID].value=r.texture),this._fsQuad.material=this.material,this.renderToScreen?(e.setRenderTarget(null),this._fsQuad.render(e)):(e.setRenderTarget(a),this.clear&&e.clear(e.autoClearColor,e.autoClearDepth,e.autoClearStencil),this._fsQuad.render(e))}dispose(){this.material.dispose(),this._fsQuad.dispose()}}class oe extends N{constructor(e,a){super(),this.scene=e,this.camera=a,this.clear=!0,this.needsSwap=!1,this.inverse=!1}render(e,a,r){const l=e.getContext(),i=e.state;i.buffers.color.setMask(!1),i.buffers.depth.setMask(!1),i.buffers.color.setLocked(!0),i.buffers.depth.setLocked(!0);let s,p;this.inverse?(s=0,p=1):(s=1,p=0),i.buffers.stencil.setTest(!0),i.buffers.stencil.setOp(l.REPLACE,l.REPLACE,l.REPLACE),i.buffers.stencil.setFunc(l.ALWAYS,s,4294967295),i.buffers.stencil.setClear(p),i.buffers.stencil.setLocked(!0),e.setRenderTarget(r),this.clear&&e.clear(),e.render(this.scene,this.camera),e.setRenderTarget(a),this.clear&&e.clear(),e.render(this.scene,this.camera),i.buffers.color.setLocked(!1),i.buffers.depth.setLocked(!1),i.buffers.color.setMask(!0),i.buffers.depth.setMask(!0),i.buffers.stencil.setLocked(!1),i.buffers.stencil.setFunc(l.EQUAL,1,4294967295),i.buffers.stencil.setOp(l.KEEP,l.KEEP,l.KEEP),i.buffers.stencil.setLocked(!0)}}class ke extends N{constructor(){super(),this.needsSwap=!1}render(e){e.state.buffers.stencil.setLocked(!1),e.state.buffers.stencil.setTest(!1)}}class it{constructor(e,a){if(this.renderer=e,this._pixelRatio=e.getPixelRatio(),a===void 0){const r=e.getSize(new T);this._width=r.width,this._height=r.height,a=new B(this._width*this._pixelRatio,this._height*this._pixelRatio,{type:w}),a.texture.name="EffectComposer.rt1"}else this._width=a.width,this._height=a.height;this.renderTarget1=a,this.renderTarget2=a.clone(),this.renderTarget2.texture.name="EffectComposer.rt2",this.writeBuffer=this.renderTarget1,this.readBuffer=this.renderTarget2,this.renderToScreen=!0,this.passes=[],this.copyPass=new Fe(W),this.copyPass.material.blending=ee,this.clock=new ge}swapBuffers(){const e=this.readBuffer;this.readBuffer=this.writeBuffer,this.writeBuffer=e}addPass(e){this.passes.push(e),e.setSize(this._width*this._pixelRatio,this._height*this._pixelRatio)}insertPass(e,a){this.passes.splice(a,0,e),e.setSize(this._width*this._pixelRatio,this._height*this._pixelRatio)}removePass(e){const a=this.passes.indexOf(e);a!==-1&&this.passes.splice(a,1)}isLastEnabledPass(e){for(let a=e+1;a<this.passes.length;a++)if(this.passes[a].enabled)return!1;return!0}render(e){e===void 0&&(e=this.clock.getDelta());const a=this.renderer.getRenderTarget();let r=!1;for(let l=0,i=this.passes.length;l<i;l++){const s=this.passes[l];if(s.enabled!==!1){if(s.renderToScreen=this.renderToScreen&&this.isLastEnabledPass(l),s.render(this.renderer,this.writeBuffer,this.readBuffer,e,r),s.needsSwap){if(r){const p=this.renderer.getContext(),d=this.renderer.state.buffers.stencil;d.setFunc(p.NOTEQUAL,1,4294967295),this.copyPass.render(this.renderer,this.writeBuffer,this.readBuffer,e),d.setFunc(p.EQUAL,1,4294967295)}this.swapBuffers()}oe!==void 0&&(s instanceof oe?r=!0:s instanceof ke&&(r=!1))}}this.renderer.setRenderTarget(a)}reset(e){if(e===void 0){const a=this.renderer.getSize(new T);this._pixelRatio=this.renderer.getPixelRatio(),this._width=a.width,this._height=a.height,e=this.renderTarget1.clone(),e.setSize(this._width*this._pixelRatio,this._height*this._pixelRatio)}this.renderTarget1.dispose(),this.renderTarget2.dispose(),this.renderTarget1=e,this.renderTarget2=e.clone(),this.writeBuffer=this.renderTarget1,this.readBuffer=this.renderTarget2}setSize(e,a){this._width=e,this._height=a;const r=this._width*this._pixelRatio,l=this._height*this._pixelRatio;this.renderTarget1.setSize(r,l),this.renderTarget2.setSize(r,l);for(let i=0;i<this.passes.length;i++)this.passes[i].setSize(r,l)}setPixelRatio(e){this._pixelRatio=e,this.setSize(this._width,this._height)}dispose(){this.renderTarget1.dispose(),this.renderTarget2.dispose(),this.copyPass.dispose()}}class rt extends N{constructor(e,a,r=null,l=null,i=null){super(),this.scene=e,this.camera=a,this.overrideMaterial=r,this.clearColor=l,this.clearAlpha=i,this.clear=!0,this.clearDepth=!1,this.needsSwap=!1,this._oldClearColor=new F}render(e,a,r){const l=e.autoClear;e.autoClear=!1;let i,s;this.overrideMaterial!==null&&(s=this.scene.overrideMaterial,this.scene.overrideMaterial=this.overrideMaterial),this.clearColor!==null&&(e.getClearColor(this._oldClearColor),e.setClearColor(this.clearColor,e.getClearAlpha())),this.clearAlpha!==null&&(i=e.getClearAlpha(),e.setClearAlpha(this.clearAlpha)),this.clearDepth==!0&&e.clearDepth(),e.setRenderTarget(this.renderToScreen?null:r),this.clear===!0&&e.clear(e.autoClearColor,e.autoClearDepth,e.autoClearStencil),e.render(this.scene,this.camera),this.clearColor!==null&&e.setClearColor(this._oldClearColor),this.clearAlpha!==null&&e.setClearAlpha(i),this.overrideMaterial!==null&&(this.scene.overrideMaterial=s),e.autoClear=l}}class G extends N{constructor(e,a,r,l){super(),this.renderScene=a,this.renderCamera=r,this.selectedObjects=l!==void 0?l:[],this.visibleEdgeColor=new F(1,1,1),this.hiddenEdgeColor=new F(.1,.04,.02),this.edgeGlow=0,this.usePatternTexture=!1,this.patternTexture=null,this.edgeThickness=1,this.edgeStrength=3,this.downSampleRatio=2,this.pulsePeriod=0,this._visibilityCache=new Map,this._selectionCache=new Set,this.resolution=e!==void 0?new T(e.x,e.y):new T(256,256);const i=Math.round(this.resolution.x/this.downSampleRatio),s=Math.round(this.resolution.y/this.downSampleRatio);this.renderTargetMaskBuffer=new B(this.resolution.x,this.resolution.y),this.renderTargetMaskBuffer.texture.name="OutlinePass.mask",this.renderTargetMaskBuffer.texture.generateMipmaps=!1,this.depthMaterial=new ve,this.depthMaterial.side=le,this.depthMaterial.depthPacking=_e,this.depthMaterial.blending=ee,this.prepareMaskMaterial=this._getPrepareMaskMaterial(),this.prepareMaskMaterial.side=le,this.prepareMaskMaterial.fragmentShader=v(this.prepareMaskMaterial.fragmentShader,this.renderCamera),this.renderTargetDepthBuffer=new B(this.resolution.x,this.resolution.y,{type:w}),this.renderTargetDepthBuffer.texture.name="OutlinePass.depth",this.renderTargetDepthBuffer.texture.generateMipmaps=!1,this.renderTargetMaskDownSampleBuffer=new B(i,s,{type:w}),this.renderTargetMaskDownSampleBuffer.texture.name="OutlinePass.depthDownSample",this.renderTargetMaskDownSampleBuffer.texture.generateMipmaps=!1,this.renderTargetBlurBuffer1=new B(i,s,{type:w}),this.renderTargetBlurBuffer1.texture.name="OutlinePass.blur1",this.renderTargetBlurBuffer1.texture.generateMipmaps=!1,this.renderTargetBlurBuffer2=new B(Math.round(i/2),Math.round(s/2),{type:w}),this.renderTargetBlurBuffer2.texture.name="OutlinePass.blur2",this.renderTargetBlurBuffer2.texture.generateMipmaps=!1,this.edgeDetectionMaterial=this._getEdgeDetectionMaterial(),this.renderTargetEdgeBuffer1=new B(i,s,{type:w}),this.renderTargetEdgeBuffer1.texture.name="OutlinePass.edge1",this.renderTargetEdgeBuffer1.texture.generateMipmaps=!1,this.renderTargetEdgeBuffer2=new B(Math.round(i/2),Math.round(s/2),{type:w}),this.renderTargetEdgeBuffer2.texture.name="OutlinePass.edge2",this.renderTargetEdgeBuffer2.texture.generateMipmaps=!1;const p=4,d=4;this.separableBlurMaterial1=this._getSeparableBlurMaterial(p),this.separableBlurMaterial1.uniforms.texSize.value.set(i,s),this.separableBlurMaterial1.uniforms.kernelRadius.value=1,this.separableBlurMaterial2=this._getSeparableBlurMaterial(d),this.separableBlurMaterial2.uniforms.texSize.value.set(Math.round(i/2),Math.round(s/2)),this.separableBlurMaterial2.uniforms.kernelRadius.value=d,this.overlayMaterial=this._getOverlayMaterial();const x=W;this.copyUniforms=X.clone(x.uniforms),this.materialCopy=new P({uniforms:this.copyUniforms,vertexShader:x.vertexShader,fragmentShader:x.fragmentShader,blending:ee,depthTest:!1,depthWrite:!1}),this.enabled=!0,this.needsSwap=!1,this._oldClearColor=new F,this.oldClearAlpha=1,this._fsQuad=new q(null),this.tempPulseColor1=new F,this.tempPulseColor2=new F,this.textureMatrix=new te;function v(o,R){const I=R.isPerspectiveCamera?"perspective":"orthographic";return o.replace(/DEPTH_TO_VIEW_Z/g,I+"DepthToViewZ")}}dispose(){this.renderTargetMaskBuffer.dispose(),this.renderTargetDepthBuffer.dispose(),this.renderTargetMaskDownSampleBuffer.dispose(),this.renderTargetBlurBuffer1.dispose(),this.renderTargetBlurBuffer2.dispose(),this.renderTargetEdgeBuffer1.dispose(),this.renderTargetEdgeBuffer2.dispose(),this.depthMaterial.dispose(),this.prepareMaskMaterial.dispose(),this.edgeDetectionMaterial.dispose(),this.separableBlurMaterial1.dispose(),this.separableBlurMaterial2.dispose(),this.overlayMaterial.dispose(),this.materialCopy.dispose(),this._fsQuad.dispose()}setSize(e,a){this.renderTargetMaskBuffer.setSize(e,a),this.renderTargetDepthBuffer.setSize(e,a);let r=Math.round(e/this.downSampleRatio),l=Math.round(a/this.downSampleRatio);this.renderTargetMaskDownSampleBuffer.setSize(r,l),this.renderTargetBlurBuffer1.setSize(r,l),this.renderTargetEdgeBuffer1.setSize(r,l),this.separableBlurMaterial1.uniforms.texSize.value.set(r,l),r=Math.round(r/2),l=Math.round(l/2),this.renderTargetBlurBuffer2.setSize(r,l),this.renderTargetEdgeBuffer2.setSize(r,l),this.separableBlurMaterial2.uniforms.texSize.value.set(r,l)}render(e,a,r,l,i){if(this.selectedObjects.length>0){e.getClearColor(this._oldClearColor),this.oldClearAlpha=e.getClearAlpha();const s=e.autoClear;e.autoClear=!1,i&&e.state.buffers.stencil.setTest(!1),e.setClearColor(16777215,1),this._updateSelectionCache(),this._changeVisibilityOfSelectedObjects(!1);const p=this.renderScene.background,d=this.renderScene.overrideMaterial;if(this.renderScene.background=null,this.renderScene.overrideMaterial=this.depthMaterial,e.setRenderTarget(this.renderTargetDepthBuffer),e.clear(),e.render(this.renderScene,this.renderCamera),this._changeVisibilityOfSelectedObjects(!0),this._visibilityCache.clear(),this._updateTextureMatrix(),this._changeVisibilityOfNonSelectedObjects(!1),this.renderScene.overrideMaterial=this.prepareMaskMaterial,this.prepareMaskMaterial.uniforms.cameraNearFar.value.set(this.renderCamera.near,this.renderCamera.far),this.prepareMaskMaterial.uniforms.depthTexture.value=this.renderTargetDepthBuffer.texture,this.prepareMaskMaterial.uniforms.textureMatrix.value=this.textureMatrix,e.setRenderTarget(this.renderTargetMaskBuffer),e.clear(),e.render(this.renderScene,this.renderCamera),this._changeVisibilityOfNonSelectedObjects(!0),this._visibilityCache.clear(),this._selectionCache.clear(),this.renderScene.background=p,this.renderScene.overrideMaterial=d,this._fsQuad.material=this.materialCopy,this.copyUniforms.tDiffuse.value=this.renderTargetMaskBuffer.texture,e.setRenderTarget(this.renderTargetMaskDownSampleBuffer),e.clear(),this._fsQuad.render(e),this.tempPulseColor1.copy(this.visibleEdgeColor),this.tempPulseColor2.copy(this.hiddenEdgeColor),this.pulsePeriod>0){const x=.625+Math.cos(performance.now()*.01/this.pulsePeriod)*.75/2;this.tempPulseColor1.multiplyScalar(x),this.tempPulseColor2.multiplyScalar(x)}this._fsQuad.material=this.edgeDetectionMaterial,this.edgeDetectionMaterial.uniforms.maskTexture.value=this.renderTargetMaskDownSampleBuffer.texture,this.edgeDetectionMaterial.uniforms.texSize.value.set(this.renderTargetMaskDownSampleBuffer.width,this.renderTargetMaskDownSampleBuffer.height),this.edgeDetectionMaterial.uniforms.visibleEdgeColor.value=this.tempPulseColor1,this.edgeDetectionMaterial.uniforms.hiddenEdgeColor.value=this.tempPulseColor2,e.setRenderTarget(this.renderTargetEdgeBuffer1),e.clear(),this._fsQuad.render(e),this._fsQuad.material=this.separableBlurMaterial1,this.separableBlurMaterial1.uniforms.colorTexture.value=this.renderTargetEdgeBuffer1.texture,this.separableBlurMaterial1.uniforms.direction.value=G.BlurDirectionX,this.separableBlurMaterial1.uniforms.kernelRadius.value=this.edgeThickness,e.setRenderTarget(this.renderTargetBlurBuffer1),e.clear(),this._fsQuad.render(e),this.separableBlurMaterial1.uniforms.colorTexture.value=this.renderTargetBlurBuffer1.texture,this.separableBlurMaterial1.uniforms.direction.value=G.BlurDirectionY,e.setRenderTarget(this.renderTargetEdgeBuffer1),e.clear(),this._fsQuad.render(e),this._fsQuad.material=this.separableBlurMaterial2,this.separableBlurMaterial2.uniforms.colorTexture.value=this.renderTargetEdgeBuffer1.texture,this.separableBlurMaterial2.uniforms.direction.value=G.BlurDirectionX,e.setRenderTarget(this.renderTargetBlurBuffer2),e.clear(),this._fsQuad.render(e),this.separableBlurMaterial2.uniforms.colorTexture.value=this.renderTargetBlurBuffer2.texture,this.separableBlurMaterial2.uniforms.direction.value=G.BlurDirectionY,e.setRenderTarget(this.renderTargetEdgeBuffer2),e.clear(),this._fsQuad.render(e),this._fsQuad.material=this.overlayMaterial,this.overlayMaterial.uniforms.maskTexture.value=this.renderTargetMaskBuffer.texture,this.overlayMaterial.uniforms.edgeTexture1.value=this.renderTargetEdgeBuffer1.texture,this.overlayMaterial.uniforms.edgeTexture2.value=this.renderTargetEdgeBuffer2.texture,this.overlayMaterial.uniforms.patternTexture.value=this.patternTexture,this.overlayMaterial.uniforms.edgeStrength.value=this.edgeStrength,this.overlayMaterial.uniforms.edgeGlow.value=this.edgeGlow,this.overlayMaterial.uniforms.usePatternTexture.value=this.usePatternTexture,i&&e.state.buffers.stencil.setTest(!0),e.setRenderTarget(r),this._fsQuad.render(e),e.setClearColor(this._oldClearColor,this.oldClearAlpha),e.autoClear=s}this.renderToScreen&&(this._fsQuad.material=this.materialCopy,this.copyUniforms.tDiffuse.value=r.texture,e.setRenderTarget(null),this._fsQuad.render(e))}_updateSelectionCache(){const e=this._selectionCache;function a(r){r.isMesh&&e.add(r)}e.clear();for(let r=0;r<this.selectedObjects.length;r++)this.selectedObjects[r].traverse(a)}_changeVisibilityOfSelectedObjects(e){const a=this._visibilityCache;for(const r of this._selectionCache)e===!0?r.visible=a.get(r):(a.set(r,r.visible),r.visible=e)}_changeVisibilityOfNonSelectedObjects(e){const a=this._visibilityCache,r=this._selectionCache;function l(i){if(i.isMesh||i.isSprite){if(!r.has(i)){const s=i.visible;(e===!1||a.get(i)===!0)&&(i.visible=e),a.set(i,s)}}else(i.isPoints||i.isLine)&&(e===!0?i.visible=a.get(i):(a.set(i,i.visible),i.visible=e))}this.renderScene.traverse(l)}_updateTextureMatrix(){this.textureMatrix.set(.5,0,0,.5,0,.5,0,.5,0,0,.5,.5,0,0,0,1),this.textureMatrix.multiply(this.renderCamera.projectionMatrix),this.textureMatrix.multiply(this.renderCamera.matrixWorldInverse)}_getPrepareMaskMaterial(){return new P({uniforms:{depthTexture:{value:null},cameraNearFar:{value:new T(.5,.5)},textureMatrix:{value:null}},vertexShader:`#include <batching_pars_vertex>
				#include <morphtarget_pars_vertex>
				#include <skinning_pars_vertex>

				varying vec4 projTexCoord;
				varying vec4 vPosition;
				uniform mat4 textureMatrix;

				void main() {

					#include <batching_vertex>
					#include <skinbase_vertex>
					#include <begin_vertex>
					#include <morphtarget_vertex>
					#include <skinning_vertex>
					#include <project_vertex>

					vPosition = mvPosition;

					vec4 worldPosition = vec4( transformed, 1.0 );

					#ifdef USE_INSTANCING

						worldPosition = instanceMatrix * worldPosition;

					#endif

					worldPosition = modelMatrix * worldPosition;

					projTexCoord = textureMatrix * worldPosition;

				}`,fragmentShader:`#include <packing>
				varying vec4 vPosition;
				varying vec4 projTexCoord;
				uniform sampler2D depthTexture;
				uniform vec2 cameraNearFar;

				void main() {

					float depth = unpackRGBAToDepth(texture2DProj( depthTexture, projTexCoord ));
					float viewZ = - DEPTH_TO_VIEW_Z( depth, cameraNearFar.x, cameraNearFar.y );
					float depthTest = (-vPosition.z > viewZ) ? 1.0 : 0.0;
					gl_FragColor = vec4(0.0, depthTest, 1.0, 1.0);

				}`})}_getEdgeDetectionMaterial(){return new P({uniforms:{maskTexture:{value:null},texSize:{value:new T(.5,.5)},visibleEdgeColor:{value:new k(1,1,1)},hiddenEdgeColor:{value:new k(1,1,1)}},vertexShader:`varying vec2 vUv;

				void main() {
					vUv = uv;
					gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
				}`,fragmentShader:`varying vec2 vUv;

				uniform sampler2D maskTexture;
				uniform vec2 texSize;
				uniform vec3 visibleEdgeColor;
				uniform vec3 hiddenEdgeColor;

				void main() {
					vec2 invSize = 1.0 / texSize;
					vec4 uvOffset = vec4(1.0, 0.0, 0.0, 1.0) * vec4(invSize, invSize);
					vec4 c1 = texture2D( maskTexture, vUv + uvOffset.xy);
					vec4 c2 = texture2D( maskTexture, vUv - uvOffset.xy);
					vec4 c3 = texture2D( maskTexture, vUv + uvOffset.yw);
					vec4 c4 = texture2D( maskTexture, vUv - uvOffset.yw);
					float diff1 = (c1.r - c2.r)*0.5;
					float diff2 = (c3.r - c4.r)*0.5;
					float d = length( vec2(diff1, diff2) );
					float a1 = min(c1.g, c2.g);
					float a2 = min(c3.g, c4.g);
					float visibilityFactor = min(a1, a2);
					vec3 edgeColor = 1.0 - visibilityFactor > 0.001 ? visibleEdgeColor : hiddenEdgeColor;
					gl_FragColor = vec4(edgeColor, 1.0) * vec4(d);
				}`})}_getSeparableBlurMaterial(e){return new P({defines:{MAX_RADIUS:e},uniforms:{colorTexture:{value:null},texSize:{value:new T(.5,.5)},direction:{value:new T(.5,.5)},kernelRadius:{value:1}},vertexShader:`varying vec2 vUv;

				void main() {
					vUv = uv;
					gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
				}`,fragmentShader:`#include <common>
				varying vec2 vUv;
				uniform sampler2D colorTexture;
				uniform vec2 texSize;
				uniform vec2 direction;
				uniform float kernelRadius;

				float gaussianPdf(in float x, in float sigma) {
					return 0.39894 * exp( -0.5 * x * x/( sigma * sigma))/sigma;
				}

				void main() {
					vec2 invSize = 1.0 / texSize;
					float sigma = kernelRadius/2.0;
					float weightSum = gaussianPdf(0.0, sigma);
					vec4 diffuseSum = texture2D( colorTexture, vUv) * weightSum;
					vec2 delta = direction * invSize * kernelRadius/float(MAX_RADIUS);
					vec2 uvOffset = delta;
					for( int i = 1; i <= MAX_RADIUS; i ++ ) {
						float x = kernelRadius * float(i) / float(MAX_RADIUS);
						float w = gaussianPdf(x, sigma);
						vec4 sample1 = texture2D( colorTexture, vUv + uvOffset);
						vec4 sample2 = texture2D( colorTexture, vUv - uvOffset);
						diffuseSum += ((sample1 + sample2) * w);
						weightSum += (2.0 * w);
						uvOffset += delta;
					}
					gl_FragColor = diffuseSum/weightSum;
				}`})}_getOverlayMaterial(){return new P({uniforms:{maskTexture:{value:null},edgeTexture1:{value:null},edgeTexture2:{value:null},patternTexture:{value:null},edgeStrength:{value:1},edgeGlow:{value:1},usePatternTexture:{value:0}},vertexShader:`varying vec2 vUv;

				void main() {
					vUv = uv;
					gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
				}`,fragmentShader:`varying vec2 vUv;

				uniform sampler2D maskTexture;
				uniform sampler2D edgeTexture1;
				uniform sampler2D edgeTexture2;
				uniform sampler2D patternTexture;
				uniform float edgeStrength;
				uniform float edgeGlow;
				uniform bool usePatternTexture;

				void main() {
					vec4 edgeValue1 = texture2D(edgeTexture1, vUv);
					vec4 edgeValue2 = texture2D(edgeTexture2, vUv);
					vec4 maskColor = texture2D(maskTexture, vUv);
					vec4 patternColor = texture2D(patternTexture, 6.0 * vUv);
					float visibilityFactor = 1.0 - maskColor.g > 0.0 ? 1.0 : 0.5;
					vec4 edgeValue = edgeValue1 + edgeValue2 * edgeGlow;
					vec4 finalColor = edgeStrength * maskColor.r * edgeValue;
					if(usePatternTexture)
						finalColor += + visibilityFactor * (1.0 - maskColor.r) * (1.0 - patternColor.r);
					gl_FragColor = finalColor;
				}`,blending:de,depthTest:!1,depthWrite:!1,transparent:!0})}}G.BlurDirectionX=new T(1,0);G.BlurDirectionY=new T(0,1);const K={name:"OutputShader",uniforms:{tDiffuse:{value:null},toneMappingExposure:{value:1}},vertexShader:`
		precision highp float;

		uniform mat4 modelViewMatrix;
		uniform mat4 projectionMatrix;

		attribute vec3 position;
		attribute vec2 uv;

		varying vec2 vUv;

		void main() {

			vUv = uv;
			gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );

		}`,fragmentShader:`

		precision highp float;

		uniform sampler2D tDiffuse;

		#include <tonemapping_pars_fragment>
		#include <colorspace_pars_fragment>

		varying vec2 vUv;

		void main() {

			gl_FragColor = texture2D( tDiffuse, vUv );

			// tone mapping

			#ifdef LINEAR_TONE_MAPPING

				gl_FragColor.rgb = LinearToneMapping( gl_FragColor.rgb );

			#elif defined( REINHARD_TONE_MAPPING )

				gl_FragColor.rgb = ReinhardToneMapping( gl_FragColor.rgb );

			#elif defined( CINEON_TONE_MAPPING )

				gl_FragColor.rgb = CineonToneMapping( gl_FragColor.rgb );

			#elif defined( ACES_FILMIC_TONE_MAPPING )

				gl_FragColor.rgb = ACESFilmicToneMapping( gl_FragColor.rgb );

			#elif defined( AGX_TONE_MAPPING )

				gl_FragColor.rgb = AgXToneMapping( gl_FragColor.rgb );

			#elif defined( NEUTRAL_TONE_MAPPING )

				gl_FragColor.rgb = NeutralToneMapping( gl_FragColor.rgb );

			#elif defined( CUSTOM_TONE_MAPPING )

				gl_FragColor.rgb = CustomToneMapping( gl_FragColor.rgb );

			#endif

			// color space

			#ifdef SRGB_TRANSFER

				gl_FragColor = sRGBTransferOETF( gl_FragColor );

			#endif

		}`};class at extends N{constructor(){super(),this.uniforms=X.clone(K.uniforms),this.material=new xe({name:K.name,uniforms:this.uniforms,vertexShader:K.vertexShader,fragmentShader:K.fragmentShader}),this._fsQuad=new q(this.material),this._outputColorSpace=null,this._toneMapping=null}render(e,a,r){this.uniforms.tDiffuse.value=r.texture,this.uniforms.toneMappingExposure.value=e.toneMappingExposure,(this._outputColorSpace!==e.outputColorSpace||this._toneMapping!==e.toneMapping)&&(this._outputColorSpace=e.outputColorSpace,this._toneMapping=e.toneMapping,this.material.defines={},Me.getTransfer(this._outputColorSpace)===Se&&(this.material.defines.SRGB_TRANSFER=""),this._toneMapping===Te?this.material.defines.LINEAR_TONE_MAPPING="":this._toneMapping===be?this.material.defines.REINHARD_TONE_MAPPING="":this._toneMapping===Ce?this.material.defines.CINEON_TONE_MAPPING="":this._toneMapping===we?this.material.defines.ACES_FILMIC_TONE_MAPPING="":this._toneMapping===ye?this.material.defines.AGX_TONE_MAPPING="":this._toneMapping===De?this.material.defines.NEUTRAL_TONE_MAPPING="":this._toneMapping===Ee&&(this.material.defines.CUSTOM_TONE_MAPPING=""),this.material.needsUpdate=!0),this.renderToScreen===!0?(e.setRenderTarget(null),this._fsQuad.render(e)):(e.setRenderTarget(a),this.clear&&e.clear(e.autoClearColor,e.autoClearDepth,e.autoClearStencil),this._fsQuad.render(e))}dispose(){this.material.dispose(),this._fsQuad.dispose()}}const st={name:"FXAAShader",uniforms:{tDiffuse:{value:null},resolution:{value:new T(1/1024,1/512)}},vertexShader:`

		varying vec2 vUv;

		void main() {

			vUv = uv;
			gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );

		}`,fragmentShader:`

		uniform sampler2D tDiffuse;
		uniform vec2 resolution;
		varying vec2 vUv;

		#define EDGE_STEP_COUNT 6
		#define EDGE_GUESS 8.0
		#define EDGE_STEPS 1.0, 1.5, 2.0, 2.0, 2.0, 4.0
		const float edgeSteps[EDGE_STEP_COUNT] = float[EDGE_STEP_COUNT]( EDGE_STEPS );

		float _ContrastThreshold = 0.0312;
		float _RelativeThreshold = 0.063;
		float _SubpixelBlending = 1.0;

		vec4 Sample( sampler2D  tex2D, vec2 uv ) {

			return texture( tex2D, uv );

		}

		float SampleLuminance( sampler2D tex2D, vec2 uv ) {

			return dot( Sample( tex2D, uv ).rgb, vec3( 0.3, 0.59, 0.11 ) );

		}

		float SampleLuminance( sampler2D tex2D, vec2 texSize, vec2 uv, float uOffset, float vOffset ) {

			uv += texSize * vec2(uOffset, vOffset);
			return SampleLuminance(tex2D, uv);

		}

		struct LuminanceData {

			float m, n, e, s, w;
			float ne, nw, se, sw;
			float highest, lowest, contrast;

		};

		LuminanceData SampleLuminanceNeighborhood( sampler2D tex2D, vec2 texSize, vec2 uv ) {

			LuminanceData l;
			l.m = SampleLuminance( tex2D, uv );
			l.n = SampleLuminance( tex2D, texSize, uv,  0.0,  1.0 );
			l.e = SampleLuminance( tex2D, texSize, uv,  1.0,  0.0 );
			l.s = SampleLuminance( tex2D, texSize, uv,  0.0, -1.0 );
			l.w = SampleLuminance( tex2D, texSize, uv, -1.0,  0.0 );

			l.ne = SampleLuminance( tex2D, texSize, uv,  1.0,  1.0 );
			l.nw = SampleLuminance( tex2D, texSize, uv, -1.0,  1.0 );
			l.se = SampleLuminance( tex2D, texSize, uv,  1.0, -1.0 );
			l.sw = SampleLuminance( tex2D, texSize, uv, -1.0, -1.0 );

			l.highest = max( max( max( max( l.n, l.e ), l.s ), l.w ), l.m );
			l.lowest = min( min( min( min( l.n, l.e ), l.s ), l.w ), l.m );
			l.contrast = l.highest - l.lowest;
			return l;

		}

		bool ShouldSkipPixel( LuminanceData l ) {

			float threshold = max( _ContrastThreshold, _RelativeThreshold * l.highest );
			return l.contrast < threshold;

		}

		float DeterminePixelBlendFactor( LuminanceData l ) {

			float f = 2.0 * ( l.n + l.e + l.s + l.w );
			f += l.ne + l.nw + l.se + l.sw;
			f *= 1.0 / 12.0;
			f = abs( f - l.m );
			f = clamp( f / l.contrast, 0.0, 1.0 );

			float blendFactor = smoothstep( 0.0, 1.0, f );
			return blendFactor * blendFactor * _SubpixelBlending;

		}

		struct EdgeData {

			bool isHorizontal;
			float pixelStep;
			float oppositeLuminance, gradient;

		};

		EdgeData DetermineEdge( vec2 texSize, LuminanceData l ) {

			EdgeData e;
			float horizontal =
				abs( l.n + l.s - 2.0 * l.m ) * 2.0 +
				abs( l.ne + l.se - 2.0 * l.e ) +
				abs( l.nw + l.sw - 2.0 * l.w );
			float vertical =
				abs( l.e + l.w - 2.0 * l.m ) * 2.0 +
				abs( l.ne + l.nw - 2.0 * l.n ) +
				abs( l.se + l.sw - 2.0 * l.s );
			e.isHorizontal = horizontal >= vertical;

			float pLuminance = e.isHorizontal ? l.n : l.e;
			float nLuminance = e.isHorizontal ? l.s : l.w;
			float pGradient = abs( pLuminance - l.m );
			float nGradient = abs( nLuminance - l.m );

			e.pixelStep = e.isHorizontal ? texSize.y : texSize.x;

			if (pGradient < nGradient) {

				e.pixelStep = -e.pixelStep;
				e.oppositeLuminance = nLuminance;
				e.gradient = nGradient;

			} else {

				e.oppositeLuminance = pLuminance;
				e.gradient = pGradient;

			}

			return e;

		}

		float DetermineEdgeBlendFactor( sampler2D  tex2D, vec2 texSize, LuminanceData l, EdgeData e, vec2 uv ) {

			vec2 uvEdge = uv;
			vec2 edgeStep;
			if (e.isHorizontal) {

				uvEdge.y += e.pixelStep * 0.5;
				edgeStep = vec2( texSize.x, 0.0 );

			} else {

				uvEdge.x += e.pixelStep * 0.5;
				edgeStep = vec2( 0.0, texSize.y );

			}

			float edgeLuminance = ( l.m + e.oppositeLuminance ) * 0.5;
			float gradientThreshold = e.gradient * 0.25;

			vec2 puv = uvEdge + edgeStep * edgeSteps[0];
			float pLuminanceDelta = SampleLuminance( tex2D, puv ) - edgeLuminance;
			bool pAtEnd = abs( pLuminanceDelta ) >= gradientThreshold;

			for ( int i = 1; i < EDGE_STEP_COUNT && !pAtEnd; i++ ) {

				puv += edgeStep * edgeSteps[i];
				pLuminanceDelta = SampleLuminance( tex2D, puv ) - edgeLuminance;
				pAtEnd = abs( pLuminanceDelta ) >= gradientThreshold;

			}

			if ( !pAtEnd ) {

				puv += edgeStep * EDGE_GUESS;

			}

			vec2 nuv = uvEdge - edgeStep * edgeSteps[0];
			float nLuminanceDelta = SampleLuminance( tex2D, nuv ) - edgeLuminance;
			bool nAtEnd = abs( nLuminanceDelta ) >= gradientThreshold;

			for ( int i = 1; i < EDGE_STEP_COUNT && !nAtEnd; i++ ) {

				nuv -= edgeStep * edgeSteps[i];
				nLuminanceDelta = SampleLuminance( tex2D, nuv ) - edgeLuminance;
				nAtEnd = abs( nLuminanceDelta ) >= gradientThreshold;

			}

			if ( !nAtEnd ) {

				nuv -= edgeStep * EDGE_GUESS;

			}

			float pDistance, nDistance;
			if ( e.isHorizontal ) {

				pDistance = puv.x - uv.x;
				nDistance = uv.x - nuv.x;

			} else {

				pDistance = puv.y - uv.y;
				nDistance = uv.y - nuv.y;

			}

			float shortestDistance;
			bool deltaSign;
			if ( pDistance <= nDistance ) {

				shortestDistance = pDistance;
				deltaSign = pLuminanceDelta >= 0.0;

			} else {

				shortestDistance = nDistance;
				deltaSign = nLuminanceDelta >= 0.0;

			}

			if ( deltaSign == ( l.m - edgeLuminance >= 0.0 ) ) {

				return 0.0;

			}

			return 0.5 - shortestDistance / ( pDistance + nDistance );

		}

		vec4 ApplyFXAA( sampler2D  tex2D, vec2 texSize, vec2 uv ) {

			LuminanceData luminance = SampleLuminanceNeighborhood( tex2D, texSize, uv );
			if ( ShouldSkipPixel( luminance ) ) {

				return Sample( tex2D, uv );

			}

			float pixelBlend = DeterminePixelBlendFactor( luminance );
			EdgeData edge = DetermineEdge( texSize, luminance );
			float edgeBlend = DetermineEdgeBlendFactor( tex2D, texSize, luminance, edge, uv );
			float finalBlend = max( pixelBlend, edgeBlend );

			if (edge.isHorizontal) {

				uv.y += edge.pixelStep * finalBlend;

			} else {

				uv.x += edge.pixelStep * finalBlend;

			}

			return Sample( tex2D, uv );

		}

		void main() {

			gl_FragColor = ApplyFXAA( tDiffuse, resolution.xy, vUv );

		}`},Ge={uniforms:{tDiffuse:{value:null},luminosityThreshold:{value:1},smoothWidth:{value:1},defaultColor:{value:new F(0)},defaultOpacity:{value:0}},vertexShader:`

		varying vec2 vUv;

		void main() {

			vUv = uv;

			gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );

		}`,fragmentShader:`

		uniform sampler2D tDiffuse;
		uniform vec3 defaultColor;
		uniform float defaultOpacity;
		uniform float luminosityThreshold;
		uniform float smoothWidth;

		varying vec2 vUv;

		void main() {

			vec4 texel = texture2D( tDiffuse, vUv );

			float v = luminance( texel.xyz );

			vec4 outputColor = vec4( defaultColor.rgb, defaultOpacity );

			float alpha = smoothstep( luminosityThreshold, luminosityThreshold + smoothWidth, v );

			gl_FragColor = mix( outputColor, texel, alpha );

		}`};class Y extends N{constructor(e,a=1,r,l){super(),this.strength=a,this.radius=r,this.threshold=l,this.resolution=e!==void 0?new T(e.x,e.y):new T(256,256),this.clearColor=new F(0,0,0),this.needsSwap=!1,this.renderTargetsHorizontal=[],this.renderTargetsVertical=[],this.nMips=5;let i=Math.round(this.resolution.x/2),s=Math.round(this.resolution.y/2);this.renderTargetBright=new B(i,s,{type:w}),this.renderTargetBright.texture.name="UnrealBloomPass.bright",this.renderTargetBright.texture.generateMipmaps=!1;for(let v=0;v<this.nMips;v++){const o=new B(i,s,{type:w});o.texture.name="UnrealBloomPass.h"+v,o.texture.generateMipmaps=!1,this.renderTargetsHorizontal.push(o);const R=new B(i,s,{type:w});R.texture.name="UnrealBloomPass.v"+v,R.texture.generateMipmaps=!1,this.renderTargetsVertical.push(R),i=Math.round(i/2),s=Math.round(s/2)}const p=Ge;this.highPassUniforms=X.clone(p.uniforms),this.highPassUniforms.luminosityThreshold.value=l,this.highPassUniforms.smoothWidth.value=.01,this.materialHighPassFilter=new P({uniforms:this.highPassUniforms,vertexShader:p.vertexShader,fragmentShader:p.fragmentShader}),this.separableBlurMaterials=[];const d=[3,5,7,9,11];i=Math.round(this.resolution.x/2),s=Math.round(this.resolution.y/2);for(let v=0;v<this.nMips;v++)this.separableBlurMaterials.push(this._getSeparableBlurMaterial(d[v])),this.separableBlurMaterials[v].uniforms.invSize.value=new T(1/i,1/s),i=Math.round(i/2),s=Math.round(s/2);this.compositeMaterial=this._getCompositeMaterial(this.nMips),this.compositeMaterial.uniforms.blurTexture1.value=this.renderTargetsVertical[0].texture,this.compositeMaterial.uniforms.blurTexture2.value=this.renderTargetsVertical[1].texture,this.compositeMaterial.uniforms.blurTexture3.value=this.renderTargetsVertical[2].texture,this.compositeMaterial.uniforms.blurTexture4.value=this.renderTargetsVertical[3].texture,this.compositeMaterial.uniforms.blurTexture5.value=this.renderTargetsVertical[4].texture,this.compositeMaterial.uniforms.bloomStrength.value=a,this.compositeMaterial.uniforms.bloomRadius.value=.1;const x=[1,.8,.6,.4,.2];this.compositeMaterial.uniforms.bloomFactors.value=x,this.bloomTintColors=[new k(1,1,1),new k(1,1,1),new k(1,1,1),new k(1,1,1),new k(1,1,1)],this.compositeMaterial.uniforms.bloomTintColors.value=this.bloomTintColors,this.copyUniforms=X.clone(W.uniforms),this.blendMaterial=new P({uniforms:this.copyUniforms,vertexShader:W.vertexShader,fragmentShader:W.fragmentShader,blending:de,depthTest:!1,depthWrite:!1,transparent:!0}),this._oldClearColor=new F,this._oldClearAlpha=1,this._basic=new Be,this._fsQuad=new q(null)}dispose(){for(let e=0;e<this.renderTargetsHorizontal.length;e++)this.renderTargetsHorizontal[e].dispose();for(let e=0;e<this.renderTargetsVertical.length;e++)this.renderTargetsVertical[e].dispose();this.renderTargetBright.dispose();for(let e=0;e<this.separableBlurMaterials.length;e++)this.separableBlurMaterials[e].dispose();this.compositeMaterial.dispose(),this.blendMaterial.dispose(),this._basic.dispose(),this._fsQuad.dispose()}setSize(e,a){let r=Math.round(e/2),l=Math.round(a/2);this.renderTargetBright.setSize(r,l);for(let i=0;i<this.nMips;i++)this.renderTargetsHorizontal[i].setSize(r,l),this.renderTargetsVertical[i].setSize(r,l),this.separableBlurMaterials[i].uniforms.invSize.value=new T(1/r,1/l),r=Math.round(r/2),l=Math.round(l/2)}render(e,a,r,l,i){e.getClearColor(this._oldClearColor),this._oldClearAlpha=e.getClearAlpha();const s=e.autoClear;e.autoClear=!1,e.setClearColor(this.clearColor,0),i&&e.state.buffers.stencil.setTest(!1),this.renderToScreen&&(this._fsQuad.material=this._basic,this._basic.map=r.texture,e.setRenderTarget(null),e.clear(),this._fsQuad.render(e)),this.highPassUniforms.tDiffuse.value=r.texture,this.highPassUniforms.luminosityThreshold.value=this.threshold,this._fsQuad.material=this.materialHighPassFilter,e.setRenderTarget(this.renderTargetBright),e.clear(),this._fsQuad.render(e);let p=this.renderTargetBright;for(let d=0;d<this.nMips;d++)this._fsQuad.material=this.separableBlurMaterials[d],this.separableBlurMaterials[d].uniforms.colorTexture.value=p.texture,this.separableBlurMaterials[d].uniforms.direction.value=Y.BlurDirectionX,e.setRenderTarget(this.renderTargetsHorizontal[d]),e.clear(),this._fsQuad.render(e),this.separableBlurMaterials[d].uniforms.colorTexture.value=this.renderTargetsHorizontal[d].texture,this.separableBlurMaterials[d].uniforms.direction.value=Y.BlurDirectionY,e.setRenderTarget(this.renderTargetsVertical[d]),e.clear(),this._fsQuad.render(e),p=this.renderTargetsVertical[d];this._fsQuad.material=this.compositeMaterial,this.compositeMaterial.uniforms.bloomStrength.value=this.strength,this.compositeMaterial.uniforms.bloomRadius.value=this.radius,this.compositeMaterial.uniforms.bloomTintColors.value=this.bloomTintColors,e.setRenderTarget(this.renderTargetsHorizontal[0]),e.clear(),this._fsQuad.render(e),this._fsQuad.material=this.blendMaterial,this.copyUniforms.tDiffuse.value=this.renderTargetsHorizontal[0].texture,i&&e.state.buffers.stencil.setTest(!0),this.renderToScreen?(e.setRenderTarget(null),this._fsQuad.render(e)):(e.setRenderTarget(r),this._fsQuad.render(e)),e.setClearColor(this._oldClearColor,this._oldClearAlpha),e.autoClear=s}_getSeparableBlurMaterial(e){const a=[];for(let r=0;r<e;r++)a.push(.39894*Math.exp(-.5*r*r/(e*e))/e);return new P({defines:{KERNEL_RADIUS:e},uniforms:{colorTexture:{value:null},invSize:{value:new T(.5,.5)},direction:{value:new T(.5,.5)},gaussianCoefficients:{value:a}},vertexShader:`varying vec2 vUv;
				void main() {
					vUv = uv;
					gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
				}`,fragmentShader:`#include <common>
				varying vec2 vUv;
				uniform sampler2D colorTexture;
				uniform vec2 invSize;
				uniform vec2 direction;
				uniform float gaussianCoefficients[KERNEL_RADIUS];

				void main() {
					float weightSum = gaussianCoefficients[0];
					vec3 diffuseSum = texture2D( colorTexture, vUv ).rgb * weightSum;
					for( int i = 1; i < KERNEL_RADIUS; i ++ ) {
						float x = float(i);
						float w = gaussianCoefficients[i];
						vec2 uvOffset = direction * invSize * x;
						vec3 sample1 = texture2D( colorTexture, vUv + uvOffset ).rgb;
						vec3 sample2 = texture2D( colorTexture, vUv - uvOffset ).rgb;
						diffuseSum += (sample1 + sample2) * w;
						weightSum += 2.0 * w;
					}
					gl_FragColor = vec4(diffuseSum/weightSum, 1.0);
				}`})}_getCompositeMaterial(e){return new P({defines:{NUM_MIPS:e},uniforms:{blurTexture1:{value:null},blurTexture2:{value:null},blurTexture3:{value:null},blurTexture4:{value:null},blurTexture5:{value:null},bloomStrength:{value:1},bloomFactors:{value:null},bloomTintColors:{value:null},bloomRadius:{value:0}},vertexShader:`varying vec2 vUv;
				void main() {
					vUv = uv;
					gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
				}`,fragmentShader:`varying vec2 vUv;
				uniform sampler2D blurTexture1;
				uniform sampler2D blurTexture2;
				uniform sampler2D blurTexture3;
				uniform sampler2D blurTexture4;
				uniform sampler2D blurTexture5;
				uniform float bloomStrength;
				uniform float bloomRadius;
				uniform float bloomFactors[NUM_MIPS];
				uniform vec3 bloomTintColors[NUM_MIPS];

				float lerpBloomFactor(const in float factor) {
					float mirrorFactor = 1.2 - factor;
					return mix(factor, mirrorFactor, bloomRadius);
				}

				void main() {
					gl_FragColor = bloomStrength * ( lerpBloomFactor(bloomFactors[0]) * vec4(bloomTintColors[0], 1.0) * texture2D(blurTexture1, vUv) +
						lerpBloomFactor(bloomFactors[1]) * vec4(bloomTintColors[1], 1.0) * texture2D(blurTexture2, vUv) +
						lerpBloomFactor(bloomFactors[2]) * vec4(bloomTintColors[2], 1.0) * texture2D(blurTexture3, vUv) +
						lerpBloomFactor(bloomFactors[3]) * vec4(bloomTintColors[3], 1.0) * texture2D(blurTexture4, vUv) +
						lerpBloomFactor(bloomFactors[4]) * vec4(bloomTintColors[4], 1.0) * texture2D(blurTexture5, vUv) );
				}`})}}Y.BlurDirectionX=new T(1,0);Y.BlurDirectionY=new T(0,1);const ue=new k,Ne=new Pe,he=new k;class lt extends Re{constructor(e=document.createElement("div")){super(),this.isCSS3DObject=!0,this.element=e,this.element.style.position="absolute",this.element.style.pointerEvents="auto",this.element.style.userSelect="none",this.element.setAttribute("draggable",!1),this.addEventListener("removed",function(){this.traverse(function(a){a.element instanceof a.element.ownerDocument.defaultView.Element&&a.element.parentNode!==null&&a.element.remove()})})}copy(e,a){return super.copy(e,a),this.element=e.element.cloneNode(!0),this}}const A=new te,Ie=new te;class nt{constructor(e={}){const a=this;let r,l,i,s;const p={camera:{style:""},objects:new WeakMap},d=e.element!==void 0?e.element:document.createElement("div");d.style.overflow="hidden",this.domElement=d;const x=document.createElement("div");x.style.transformOrigin="0 0",x.style.pointerEvents="none",d.appendChild(x);const v=document.createElement("div");v.style.transformStyle="preserve-3d",x.appendChild(v),this.getSize=function(){return{width:r,height:l}},this.render=function(u,t){const b=t.projectionMatrix.elements[5]*s;t.view&&t.view.enabled?(x.style.transform=`translate( ${-t.view.offsetX*(r/t.view.width)}px, ${-t.view.offsetY*(l/t.view.height)}px )`,x.style.transform+=`scale( ${t.view.fullWidth/t.view.width}, ${t.view.fullHeight/t.view.height} )`):x.style.transform="",u.matrixWorldAutoUpdate===!0&&u.updateMatrixWorld(),t.parent===null&&t.matrixWorldAutoUpdate===!0&&t.updateMatrixWorld();let V,C;t.isOrthographicCamera&&(V=-(t.right+t.left)/2,C=(t.top+t.bottom)/2);const y=t.view&&t.view.enabled?t.view.height/t.view.fullHeight:1,E=t.isOrthographicCamera?`scale( ${y} )scale(`+b+")translate("+o(V)+"px,"+o(C)+"px)"+R(t.matrixWorldInverse):`scale( ${y} )translateZ(`+b+"px)"+R(t.matrixWorldInverse),n=(t.isPerspectiveCamera?"perspective("+b+"px) ":"")+E+"translate("+i+"px,"+s+"px)";p.camera.style!==n&&(v.style.transform=n,p.camera.style=n),$(u,u,t)},this.setSize=function(u,t){r=u,l=t,i=r/2,s=l/2,d.style.width=u+"px",d.style.height=t+"px",x.style.width=u+"px",x.style.height=t+"px",v.style.width=u+"px",v.style.height=t+"px"};function o(u){return Math.abs(u)<1e-10?0:u}function R(u){const t=u.elements;return"matrix3d("+o(t[0])+","+o(-t[1])+","+o(t[2])+","+o(t[3])+","+o(t[4])+","+o(-t[5])+","+o(t[6])+","+o(t[7])+","+o(t[8])+","+o(-t[9])+","+o(t[10])+","+o(t[11])+","+o(t[12])+","+o(-t[13])+","+o(t[14])+","+o(t[15])+")"}function I(u){const t=u.elements;return"translate(-50%,-50%)"+("matrix3d("+o(t[0])+","+o(t[1])+","+o(t[2])+","+o(t[3])+","+o(-t[4])+","+o(-t[5])+","+o(-t[6])+","+o(-t[7])+","+o(t[8])+","+o(t[9])+","+o(t[10])+","+o(t[11])+","+o(t[12])+","+o(t[13])+","+o(t[14])+","+o(t[15])+")")}function j(u){u.isCSS3DObject&&(u.element.style.display="none");for(let t=0,b=u.children.length;t<b;t++)j(u.children[t])}function $(u,t,b,V){if(u.visible===!1){j(u);return}if(u.isCSS3DObject){const C=u.layers.test(b.layers)===!0,y=u.element;if(y.style.display=C===!0?"":"none",C===!0){u.onBeforeRender(a,t,b);let E;u.isCSS3DSprite?(A.copy(b.matrixWorldInverse),A.transpose(),u.rotation2D!==0&&A.multiply(Ie.makeRotationZ(u.rotation2D)),u.matrixWorld.decompose(ue,Ne,he),A.setPosition(ue),A.scale(he),A.elements[3]=0,A.elements[7]=0,A.elements[11]=0,A.elements[15]=1,E=I(A)):E=I(u.matrixWorld);const L=p.objects.get(u);if(L===void 0||L.style!==E){y.style.transform=E;const n={style:E};p.objects.set(u,n)}y.parentNode!==v&&v.appendChild(y),u.onAfterRender(a,t,b)}}for(let C=0,y=u.children.length;C<y;C++)$(u.children[C],t,b)}}}class ot extends Le{constructor(e){super(e),this.type=w}parse(e){const s=function(n,f){switch(n){case 1:throw new Error("THREE.RGBELoader: Read Error: "+(f||""));case 2:throw new Error("THREE.RGBELoader: Write Error: "+(f||""));case 3:throw new Error("THREE.RGBELoader: Bad File Format: "+(f||""));default:case 4:throw new Error("THREE.RGBELoader: Memory Error: "+(f||""))}},v=`
`,o=function(n,f,m){f=f||1024;let M=n.pos,_=-1,h=0,S="",c=String.fromCharCode.apply(null,new Uint16Array(n.subarray(M,M+128)));for(;0>(_=c.indexOf(v))&&h<f&&M<n.byteLength;)S+=c,h+=c.length,M+=128,c+=String.fromCharCode.apply(null,new Uint16Array(n.subarray(M,M+128)));return-1<_?(n.pos+=h+_+1,S+c.slice(0,_)):!1},R=function(n){const f=/^#\?(\S+)/,m=/^\s*GAMMA\s*=\s*(\d+(\.\d+)?)\s*$/,g=/^\s*EXPOSURE\s*=\s*(\d+(\.\d+)?)\s*$/,M=/^\s*FORMAT=(\S+)\s*$/,_=/^\s*\-Y\s+(\d+)\s+\+X\s+(\d+)\s*$/,h={valid:0,string:"",comments:"",programtype:"RGBE",format:"",gamma:1,exposure:1,width:0,height:0};let S,c;for((n.pos>=n.byteLength||!(S=o(n)))&&s(1,"no header found"),(c=S.match(f))||s(3,"bad initial token"),h.valid|=1,h.programtype=c[1],h.string+=S+`
`;S=o(n),S!==!1;){if(h.string+=S+`
`,S.charAt(0)==="#"){h.comments+=S+`
`;continue}if((c=S.match(m))&&(h.gamma=parseFloat(c[1])),(c=S.match(g))&&(h.exposure=parseFloat(c[1])),(c=S.match(M))&&(h.valid|=2,h.format=c[1]),(c=S.match(_))&&(h.valid|=4,h.height=parseInt(c[1],10),h.width=parseInt(c[2],10)),h.valid&2&&h.valid&4)break}return h.valid&2||s(3,"missing format specifier"),h.valid&4||s(3,"missing image size specifier"),h},I=function(n,f,m){const g=f;if(g<8||g>32767||n[0]!==2||n[1]!==2||n[2]&128)return new Uint8Array(n);g!==(n[2]<<8|n[3])&&s(3,"wrong scanline width");const M=new Uint8Array(4*f*m);M.length||s(4,"unable to allocate buffer space");let _=0,h=0;const S=4*g,c=new Uint8Array(4),H=new Uint8Array(S);let ie=m;for(;ie>0&&h<n.byteLength;){h+4>n.byteLength&&s(1),c[0]=n[h++],c[1]=n[h++],c[2]=n[h++],c[3]=n[h++],(c[0]!=2||c[1]!=2||(c[2]<<8|c[3])!=g)&&s(3,"bad rgbe scanline format");let Q=0,z;for(;Q<S&&h<n.byteLength;){z=n[h++];const U=z>128;if(U&&(z-=128),(z===0||Q+z>S)&&s(3,"bad scanline data"),U){const O=n[h++];for(let re=0;re<z;re++)H[Q++]=O}else H.set(n.subarray(h,h+z),Q),Q+=z,h+=z}const fe=g;for(let U=0;U<fe;U++){let O=0;M[_]=H[U+O],O+=g,M[_+1]=H[U+O],O+=g,M[_+2]=H[U+O],O+=g,M[_+3]=H[U+O],_+=4}ie--}return M},j=function(n,f,m,g){const M=n[f+3],_=Math.pow(2,M-128)/255;m[g+0]=n[f+0]*_,m[g+1]=n[f+1]*_,m[g+2]=n[f+2]*_,m[g+3]=1},$=function(n,f,m,g){const M=n[f+3],_=Math.pow(2,M-128)/255;m[g+0]=Z.toHalfFloat(Math.min(n[f+0]*_,65504)),m[g+1]=Z.toHalfFloat(Math.min(n[f+1]*_,65504)),m[g+2]=Z.toHalfFloat(Math.min(n[f+2]*_,65504)),m[g+3]=Z.toHalfFloat(1)},u=new Uint8Array(e);u.pos=0;const t=R(u),b=t.width,V=t.height,C=I(u.subarray(u.pos),b,V);let y,E,L;switch(this.type){case J:L=C.length/4;const n=new Float32Array(L*4);for(let m=0;m<L;m++)j(C,m*4,n,m*4);y=n,E=J;break;case w:L=C.length/4;const f=new Uint16Array(L*4);for(let m=0;m<L;m++)$(C,m*4,f,m*4);y=f,E=w;break;default:throw new Error("THREE.RGBELoader: Unsupported type: "+this.type)}return{width:b,height:V,data:y,header:t.string,gamma:t.gamma,exposure:t.exposure,type:E}}setDataType(e){return this.type=e,this}load(e,a,r,l){function i(s,p){switch(s.type){case J:case w:s.colorSpace=Ae,s.minFilter=ne,s.magFilter=ne,s.generateMipmaps=!1,s.flipY=!0;break}a&&a(s,p)}return super.load(e,i,r,l)}}export{lt as C,it as E,st as F,et as I,Ye as M,G as O,Qe as P,ot as R,Fe as S,Ke as U,qe as a,nt as b,rt as c,at as d,Y as e,Xe as f,$e as g,Je as h,je as i,Ze as j,tt as m,We as v};
