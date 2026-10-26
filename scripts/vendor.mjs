import {copyFile,mkdir} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
await mkdir('site/vendor',{recursive:true});
await copyFile('node_modules/peerjs/dist/peerjs.min.js','site/vendor/peerjs.min.js');
await copyFile('node_modules/peerjs/LICENSE','site/vendor/peerjs-LICENSE.txt');
const result=spawnSync(process.platform==='win32'?'python':'python3',['scripts/assets.py'],{stdio:'inherit'});
if(result.status!==0)process.exit(result.status||1);
