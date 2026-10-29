import {build} from 'esbuild';
import {mkdir,readdir,copyFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=new URL('../',import.meta.url),dest=new URL('../dist/voice-runtime/',import.meta.url);await mkdir(dest,{recursive:true});
await build({absWorkingDir:fileURLToPath(root),entryPoints:['src/local-voice.js'],outdir:'dist/voice-runtime',bundle:true,format:'esm',splitting:true,entryNames:'local-voice',minify:true,loader:{'.wasm':'file'}});
const require=createRequire(import.meta.url),ort=path.dirname(require.resolve('onnxruntime-web')),sopro=path.join(path.dirname(require.resolve('@soprotts/onnx-web')),'runtime');
for(const folder of [ort,sopro])for(const name of await readdir(folder))if((folder===sopro||name.startsWith('ort-wasm-'))&&/\.(?:wasm|mjs)$/.test(name))await copyFile(path.join(folder,name),new URL(name,dest));
console.log('Voz local gratuita compilada.');

for(const [pkg,label] of [['@soprotts/onnx-web','sopro'],['onnxruntime-web','onnxruntime']]){let dir=path.dirname(require.resolve(pkg));for(let i=0;i<3;i++){for(const name of ['LICENSE','LICENSE.txt','LICENSE.md','ThirdPartyNotices.txt'])try{await copyFile(path.join(dir,name),new URL(label+'-'+name,dest))}catch{}dir=path.dirname(dir)}}
