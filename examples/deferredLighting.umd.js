(function(s,l){typeof exports=="object"&&typeof module<"u"?l(exports,require("@babylonjs/core/Maths/math.vector"),require("@babylonjs/core/Maths/math.color"),require("@babylonjs/core/Rendering/geometryBufferRenderer"),require("@babylonjs/core/Materials/Textures/texture"),require("@babylonjs/core/Engines/constants"),require("@babylonjs/core/Materials/Textures/rawTexture"),require("@babylonjs/core/PostProcesses/postProcess"),require("@babylonjs/core/Rendering/prePassRendererSceneComponent"),require("@babylonjs/core/Rendering/geometryBufferRendererSceneComponent")):typeof define=="function"&&define.amd?define(["exports","@babylonjs/core/Maths/math.vector","@babylonjs/core/Maths/math.color","@babylonjs/core/Rendering/geometryBufferRenderer","@babylonjs/core/Materials/Textures/texture","@babylonjs/core/Engines/constants","@babylonjs/core/Materials/Textures/rawTexture","@babylonjs/core/PostProcesses/postProcess","@babylonjs/core/Rendering/prePassRendererSceneComponent","@babylonjs/core/Rendering/geometryBufferRendererSceneComponent"],l):(s=typeof globalThis<"u"?globalThis:s||self,l(s.DeferredLighting={},s.BABYLON.Vector3,s.BABYLON.Color3,s.BABYLON.GeometryBufferRenderer,s.BABYLON.Texture,s.BABYLON.Constants,s.BABYLON.RawTexture,s.BABYLON.PostProcess))})(this,function(s,l,E,b,N,m,R,y){"use strict";var C=Object.defineProperty;var O=(s,l,E)=>l in s?C(s,l,{enumerable:!0,configurable:!0,writable:!0,value:E}):s[l]=E;var i=(s,l,E)=>O(s,typeof l!="symbol"?l+"":l,E);var S=`in vec2 vUV;
uniform int lights_len;
uniform vec2 screenSize;
uniform vec3 camera_position;

#ifdef IS_PERFORMANCE_MODE
  uniform vec4 lights_position_range[TOTAL_PERFORMANCE_LIGHTS_ALLOWED];
  uniform vec4 lights_color_intensity[TOTAL_PERFORMANCE_LIGHTS_ALLOWED];
#else
  uniform sampler2D point_lights_data;
  float assembleNumber(int A, int B, int C, int D) {
  int preIntPart = A * 256 + B;
  int integerPart = A < 128 ? preIntPart : preIntPart - 65536;
  int fractionalBinary = C * 256 + D;
  float fractionalPart = float(fractionalBinary) / 65535.0;

  return float(integerPart) + fractionalPart;
}
#endif

uniform sampler2D textureSampler;
uniform sampler2D nBuffer;
uniform sampler2D pBuffer;
uniform sampler2D rBuffer;

vec3 fresnelSchlick(float cosTheta, vec3 F0) {
    return F0 + (1.0 - F0) * pow(1.0 - cosTheta, 5.0);
}

float D_GGX(float NoH, float roughness) {
    float alpha = roughness * roughness;
    float alpha2 = alpha * alpha;
    float NoH2 = NoH * NoH;
    float b = (NoH2 * (alpha2 - 1.0) + 1.0);
    return alpha2 * RECIPROCAL_PI / (b * b);
}

float G1_GGX_Schlick(float NoV, float roughness) {
    float alpha = roughness * roughness;
    float k = alpha / 2.0;
    return max(NoV, 0.001) / (NoV * (1.0 - k) + k);
}

float G_Smith(float NoV, float NoL, float roughness) {
    return G1_GGX_Schlick(NoL, roughness) * G1_GGX_Schlick(NoV, roughness);
}

float fresnelSchlick90(float cosTheta, float F0, float F90) {
    return F0 + (F90 - F0) * pow(1.0 - cosTheta, 5.0);
} 

float disneyDiffuseFactor(float NoV, float NoL, float VoH, float roughness) {
    float alpha = roughness * roughness;
    float F90 = 0.5 + 2.0 * alpha * VoH * VoH;
    float F_in = fresnelSchlick90(NoL, 1.0, F90);
    float F_out = fresnelSchlick90(NoV, 1.0, F90);
    return F_in * F_out;
}

vec3 brdfMicrofacets(vec3 L, vec3 V, vec3 N, float metallic, float roughness, vec3 baseColor, float reflectance) {
    vec3 H = normalize(V + L);
    
    float NoV = clamp(dot(N, V), 0.0, 1.0);
    float NoL = clamp(dot(N, L), 0.0, 1.0);
    float NoH = clamp(dot(N, H), 0.0, 1.0);
    float VoH = clamp(dot(V, H), 0.0, 1.0);
    
    vec3 f0 = vec3(0.16 * (reflectance * reflectance));
    f0 = mix(f0, baseColor, metallic);
    
    vec3 F = fresnelSchlick(VoH, f0);
    float D = D_GGX(NoH, roughness);
    float G = G_Smith(NoV, NoL, roughness);
    
    vec3 spec = (F * D * G) / (4.0 * max(NoV, 0.001) * max(NoL, 0.001));
    
    vec3 rhoD = baseColor;
    
    
    rhoD *= vec3(1.0) - F;
    rhoD *= disneyDiffuseFactor(NoV, NoL, VoH, roughness);
    
    rhoD *= (1.0 - metallic);
    
    vec3 diff = rhoD * RECIPROCAL_PI;

    return diff + spec;
}

vec3 getColor (
    float intensity,
    vec3 light_p,
    vec3 light_color,
    float light_range,
    vec4 color,
    vec4 normals,
    vec4 p0,
    vec4 refl
) {
    vec3 d = light_p - p0.rgb;
    float r = length(d);
    vec3 l = d / r;
    vec3 n = normals.rgb;

    float normalFactor = pow(max(0.0, dot(n, l)), 2.0);
    float distanceFactor = clamp(pow( intensity / r , 2.0), 0.0, 1.0);
    float mixFactor = distanceFactor * normalFactor;
    float rangeClampFactor = light_range == 0.0 ? 1.0 : smoothstep(light_range, light_range - 0.1, r);
    vec3 final_standard = max(vec3(0.0), light_color * clamp(mixFactor, 0.0, 1.0)) * rangeClampFactor;

    float roughness = 1.0 - refl.a;
    float metalness = refl.b;
    
    #ifdef IS_USING_GBUFFER
        if (roughness == 0.0) {
            return final_standard;
        }
    #else
        if (roughness == 0.0 && metalness == 0.0) {
            return final_standard;
        }
    #endif

    vec3 v = normalize(camera_position - p0.rgb);
    
    return brdfMicrofacets(l, v, normalize(n), metalness, roughness, color.rgb * light_color, 0.5) * rangeClampFactor;
}

void main(void) {
    vec4 normals = texture2D(nBuffer, vUV);
    vec4 color = texture2D(textureSampler, vUV);
    if (normals.a == 0.0) {
        gl_FragColor = color;
        return;
    }

    vec4 pbuff = texture2D(pBuffer, vUV);
    vec4 refl = texture2D(rBuffer, vUV);

    for (int i = 0; i < lights_len; i++) {
        #ifdef IS_PERFORMANCE_MODE
          vec4 ci = lights_color_intensity[i];
float true_px = lights_position_range[i].x;
float true_py = lights_position_range[i].y;
float true_pz = lights_position_range[i].z;
float true_range = lights_position_range[i].w;
        #else
          float texIndex = (float(i) / TOTAL_LIGHTS_ALLOWED);
vec4 ci = texture2D(point_lights_data, vec2(texIndex, 0.0 / POINTS_DATA_TEXTURE_HEIGHT));
vec4 px = texture2D(point_lights_data, vec2(texIndex, 1.001 / POINTS_DATA_TEXTURE_HEIGHT)) * 255.0;
vec4 py = texture2D(point_lights_data, vec2(texIndex, 2.001 / POINTS_DATA_TEXTURE_HEIGHT)) * 255.0;
vec4 pz = texture2D(point_lights_data, vec2(texIndex, 3.001 / POINTS_DATA_TEXTURE_HEIGHT)) * 255.0;
vec4 range = texture2D(point_lights_data, vec2(texIndex, 1.0)) * 255.0;

float true_px = assembleNumber(int(px.r), int(px.g), int(px.b), int(px.a));
float true_py = assembleNumber(int(py.r), int(py.g), int(py.b), int(py.a));
float true_pz = assembleNumber(int(pz.r), int(pz.g), int(pz.b), int(pz.a));
float true_range = assembleNumber(int(range.r), int(range.g), int(range.b), int(range.a));
        #endif

        color.rgb += getColor(
            abs(ci.a * 10.0),
            vec3(true_px, true_py, true_pz),
            normalize(ci.rgb),
            true_range,
            color,
            normals,
            pbuff,
            refl
        );
    }
    
    gl_FragColor = color;
}`;class P{}i(P,"splitNumber",o=>{(o<-32768||o>=32768)&&(console.error("position out of range, clamping: only have precision for ranges -32768 to 32767"),o<0?o=-32768:o=32767);const e=Math.floor(o);let n,a;if(e<0){const p=65536+e;n=p>>8&255,a=p&255}else n=e>>8&255,a=e&255;const r=o-e,f=Math.round(r*65535),u=f>>8&255,h=f&255;return[n,a,u,h]});const c=class c{constructor(){i(this,"uniqueId");i(this,"alwaysSelectAsActiveLight",!1);i(this,"isVisible",!0);i(this,"range",20);i(this,"position",l.Vector3.Zero());this.uniqueId=c.getUniqueId()}clone(){throw new Error("Method not implemented")}static getUniqueId(){return this.uniqueId++,this.uniqueId}static freezeActive(){this.isFrustumCullingEnabled=!1}static unfreezeActive(){this.isFrustumCullingEnabled=!0}static updateActive(o){if(this.isFrustumCullingEnabled){this.activeLights=[];for(const e in this.lights){const n=this.lights[e];if(!n.range||n.alwaysSelectAsActiveLight){this.activeLights.push(n);continue}let a=!0;for(const r of o)if(r.dotCoordinate(n.position)<=-n.range){a=!1;break}a&&this.activeLights.push(n)}}}static getAll(o){if(!o)return Object.values(this.lights);const e=o.active?this.activeLights:Object.values(this.lights),n=[],a=this.isPerformanceMode?this.TOTAL_PERFORMANCE_LIGHTS_ALLOWED:this.TOTAL_LIGHTS_ALLOWED;for(let r=0;r<e.length;r++){const f=e[r];if(!(o.visible&&!f.isVisible)&&(n.push(f),o.capLength&&n.length===a))break}return n}static getById(o){return this.lights[o]??null}static remove(o){if(o instanceof c){delete this.lights[o.uniqueId];return}delete this.lights[o]}static add(o){return this.lights[o.uniqueId]=o,o.uniqueId}static disable(){!this.attachedCamera||!this.postProcess||(this.attachedCamera.detachPostProcess(this.postProcess),this.postProcess.dispose(),this.postProcess=null,this.attachedCamera=null)}static reset(){this.postProcess&&this.postProcess.dispose(),this.postProcess=null,this.attachedCamera=null,this.isFrustumCullingEnabled=!0,this.activeLights=[],this.lights={},this.isPerformanceMode=!1,this.TOTAL_LIGHTS_ALLOWED=1024,this.TOTAL_PERFORMANCE_LIGHTS_ALLOWED=128}};i(c,"uniqueId",-1),i(c,"isPerformanceMode",!1),i(c,"TOTAL_LIGHTS_ALLOWED",1024),i(c,"TOTAL_PERFORMANCE_LIGHTS_ALLOWED",128),i(c,"lights",{}),i(c,"activeLights",[]),i(c,"isFrustumCullingEnabled",!0),i(c,"attachedCamera",null),i(c,"postProcess",null);let v=c;class L extends v{constructor(e={}){super();i(this,"color",new E.Color3(0,1,1));i(this,"position",new l.Vector3(1,0,0));i(this,"intensity",.05);this.color=e.color??this.color,this.position=e.position??this.position,this.intensity=e.intensity??this.intensity,this.range=e.range??this.range}clone(){return new L({color:this.color,position:this.position,intensity:this.intensity,range:this.range})}static add(e){if(e instanceof L)return this.lights[e.uniqueId]=e,e.uniqueId;const n=new L(e);return this.add(n)}getPositionArray(e=!0){return e?[P.splitNumber(this.position.x),P.splitNumber(this.position.y),P.splitNumber(this.position.z),P.splitNumber(this.range)]:[this.position.x,this.position.y,this.position.z,this.range]}getColorIntensityArray(e=!0){const n=e?255:1;return[this.color.r*n,this.color.g*n,this.color.b*n,this.intensity*n]}static getDataBuffer(e){const n=new Array((this.TOTAL_LIGHTS_ALLOWED-e.length)*4).fill(1),a=[],r=[],f=[],u=[],h=[];for(const x of e){const A=x.getColorIntensityArray(),I=x.getPositionArray();for(let t=0;t<4;t++)a.push(A[t]),r.push(I[0][t]),f.push(I[1][t]),u.push(I[2][t]),h.push(I[3][t])}const p=a.concat(n).concat(r).concat(n).concat(f).concat(n).concat(u).concat(n).concat(h).concat(n);return new Uint8Array(p)}static enable(e,n,a,r,f=!1){this.isPerformanceMode=f;const u=!!r;if(a=a??e.activeCamera,!a)throw new Error("No Camera Found");this.attachedCamera=a;let h;if(u){r.enablePosition=!0,r.enableReflectivity=!0,r.generateNormalsInWorldSpace=!0;const t=r.getGBuffer();h=()=>{const _=r.getTextureIndex(b.GeometryBufferRenderer.NORMAL_TEXTURE_TYPE),g=r.getTextureIndex(b.GeometryBufferRenderer.POSITION_TEXTURE_TYPE),d=r.getTextureIndex(b.GeometryBufferRenderer.REFLECTIVITY_TEXTURE_TYPE);return[t.textures[_],t.textures[g],t.textures[d]]}}else{const t=e.enablePrePassRenderer();if(!t)throw new Error("failed to make preprass renderer");t.doNotUseGeometryRendererFallback=!0,t.generateNormalsInWorldSpace=!0,h=()=>{const _=t.getIndex(m.Constants.PREPASS_NORMAL_TEXTURE_TYPE),g=t.getIndex(m.Constants.PREPASS_POSITION_TEXTURE_TYPE),d=t.getIndex(m.Constants.PREPASS_REFLECTIVITY_TEXTURE_TYPE);return[t.getRenderTarget().textures[_],t.getRenderTarget().textures[g],t.getRenderTarget().textures[d]]}}const p=5,x=R.RawTexture.CreateRGBATexture(this.getDataBuffer([]),this.TOTAL_LIGHTS_ALLOWED,p,e,!1,void 0,N.Texture.NEAREST_NEAREST);let A="";A+=`precision highp float;
#define TOTAL_LIGHTS_ALLOWED ${this.TOTAL_LIGHTS_ALLOWED}.0
#define POINTS_DATA_TEXTURE_HEIGHT ${p}.0
#define RECIPROCAL_PI 0.318309886
`,this.isPerformanceMode&&(A+=`#define IS_PERFORMANCE_MODE 1
#define TOTAL_PERFORMANCE_LIGHTS_ALLOWED ${this.TOTAL_PERFORMANCE_LIGHTS_ALLOWED}
`),u&&(A+=`
#define IS_USING_GBUFFER 1
`);const I=A+S;n.deferredPointLightsFragmentShader=I,this.postProcess=new y.PostProcess("Deferred Point Lights","deferredPointLights",["lights_len","camera_position","screenSize"].concat(this.isPerformanceMode?["lights_position_range","lights_color_intensity"]:[]),["nBuffer","pBuffer","rBuffer"].concat(this.isPerformanceMode?[]:["point_lights_data"]),1,a,void 0,e.getEngine()),u||(this.postProcess._prePassEffectConfiguration={enabled:!0,name:"__deferredPointLights__",texturesRequired:[m.Constants.PREPASS_POSITION_TEXTURE_TYPE,m.Constants.PREPASS_REFLECTIVITY_TEXTURE_TYPE,m.Constants.PREPASS_NORMAL_TEXTURE_TYPE]}),this.postProcess.onApply=t=>{this.updateActive(e.frustumPlanes);const _=a.globalPosition,g=this.getAll({active:!0,visible:!0,capLength:!0});this.isPerformanceMode||x.update(this.getDataBuffer(g));const d=h();t.setTexture("nBuffer",d[0]),t.setTexture("pBuffer",d[1]),t.setTexture("rBuffer",d[2]),this.isPerformanceMode?(t.setFloatArray4("lights_position_range",g.map(T=>T.getPositionArray(!1)).flatMap(T=>T)),t.setFloatArray4("lights_color_intensity",g.map(T=>T.getColorIntensityArray(!1)).flatMap(T=>T))):t.setTexture("point_lights_data",x),t.setInt("lights_len",g.length),t.setFloat3("camera_position",_.x,_.y,_.z),t.setFloat2("screenSize",this.postProcess.width,this.postProcess.height)}}}s.AbstractDeferredLight=v,s.Bits=P,s.DeferredPointLight=L,Object.defineProperty(s,Symbol.toStringTag,{value:"Module"})});
