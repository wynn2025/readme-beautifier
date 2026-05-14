#!/usr/bin/env node
const https = require("https");
const fs = require("fs");

const C={reset:"[0m",bold:"[1m",dim:"[2m",green:"[32m",yellow:"[33m",red:"[31m",cyan:"[36m"};
function log(m,c){console.log(c?c+m+C.reset:m)}
function err(m){log("[ERROR] "+m,C.red);process.exit(1)}

function parseArgs(){
  const args=process.argv.slice(2);
  if(!args.length||args.includes("--help")||args.includes("-h")){
    console.log(C.cyan+"GitHub README Beautifier"+C.reset+" v1.0.0");
    console.log("Usage: node main.js <repo-url> [options]");
    console.log("  --output <path>   --template standard|minimal|full");
    console.log("  --token <tok>     --no-badges  --no-tree  --dry-run");
    process.exit(0);
  }
  const r={repoUrl:null,output:"./README_GENERATED.md",template:"standard",token:null,badges:true,tree:true,dryRun:false};
  for(let i=0;i<args.length;i++){
    if(args[i]==="--output")r.output=args[++i];
    else if(args[i]==="--template")r.template=args[++i];
    else if(args[i]==="--token")r.token=args[++i];
    else if(args[i]==="--no-badges")r.badges=false;
    else if(args[i]==="--no-tree")r.tree=false;
    else if(args[i]==="--dry-run")r.dryRun=true;
    else if(!args[i].startsWith("--"))r.repoUrl=args[i];
  }
  return r;
}

function apiReq(p,tok){
  return new Promise((ok,no)=>{
    const o={hostname:"api.github.com",path:p,method:"GET",headers:{"User-Agent":"README-Beautifier/1.0"}};
    if(tok)o.headers["Authorization"]="token "+tok;
    const req=https.request(o,res=>{
      let d="";res.on("data",ch=>d+=ch);
      res.on("end",()=>{
        if(res.statusCode===200)try{ok(JSON.parse(d))}catch(e){no(e)}
        else if(res.statusCode===403)no(new Error("Rate limited. Use --token."))
        else no(new Error("API error "+res.statusCode))
      });
    });
    req.on("error",no);
    req.setTimeout(15000,()=>{req.destroy();no(new Error("Timeout"))});
    req.end();
  });
}

function parseRepo(s){
  s=s.trim().replace(/.git$/,"");
  let m=s.match(/github.com[/]([^/]+)[/]([^/]+)/);
  if(m)return{owner:m[1],repo:m[2]};
  m=s.match(/^([^/]+)[/]([^/]+)$/);
  if(m)return{owner:m[1],repo:m[2]};
  err("Invalid repo. Use: https://github.com/user/repo");
}

async function fetchData(o,r,tok){
  log("Fetching "+o+"/"+r+"...",C.cyan);
  const [info,langs]=await Promise.all([
    apiReq("/repos/"+o+"/"+r,tok).catch(e=>err(e.message)),
    apiReq("/repos/"+o+"/"+r+"/languages",tok).catch(()=>({}))
  ]);
  let tree=null;
  if(info.default_branch){try{tree=await apiReq("/repos/"+o+"/"+r+"/git/trees/"+info.default_branch+"?recursive=1",tok)}catch(e){}}
  return{info,langs,tree};
}

const CB=String.fromCharCode(96,96,96);

function badges(info,o,r){
  const s="https://img.shields.io/github";const b=[];
  b.push("[![License]("+s+"/license/"+o+"/"+r+")](https://github.com/"+o+"/"+r+"/blob/main/LICENSE)");
  if(info.stargazers_count>0)b.push("[![Stars]("+s+"/stars/"+o+"/"+r+")](https://github.com/"+o+"/"+r+"/stargazers)");
  if(info.forks_count>0)b.push("[![Forks]("+s+"/forks/"+o+"/"+r+")](https://github.com/"+o+"/"+r+"/network/members)");
  b.push("[![Issues]("+s+"/issues/"+o+"/"+r+")](https://github.com/"+o+"/"+r+"/issues)");
  b.push("[![Last Commit]("+s+"/last-commit/"+o+"/"+r+")](https://github.com/"+o+"/"+r+"/commits)");
  if(info.language)b.push("[![Lang](https://img.shields.io/badge/language-"+encodeURIComponent(info.language)+"-blue)]()");
  return b.join("  ");
}

function treeStr(tree){
  if(!tree||!tree.tree)return"(unavailable)";
  const entries=tree.tree.filter(e=>e.type==="blob"||e.type==="tree");
  const lines=[];
  for(let i=0;i<Math.min(entries.length,50);i++){
    const e=entries[i];const depth=e.path.split("/").length-1;
    const indent="  ".repeat(depth);const conn=depth>0?"├── ":"";
    lines.push(indent+conn+e.path.split("/").pop()+(e.type==="tree"?"/":""));
  }
  if(entries.length>50)lines.push("... ("+(entries.length-50)+" more)");
  return lines.join("\n");
}

function install(info,langs){
  const lang=info.language||Object.keys(langs||{})[0]||"";
  const n=info.name,f=info.full_name;
  if(/javascript|typescript|node/i.test(lang))return"## Installation\n\n"+CB+"bash\ngit clone https://github.com/"+f+".git\ncd "+n+"\nnpm install\n"+CB;
  if(/python/i.test(lang))return"## Installation\n\n"+CB+"bash\ngit clone https://github.com/"+f+".git\ncd "+n+"\npip install -r requirements.txt\n"+CB;
  if(/go/i.test(lang))return"## Installation\n\n"+CB+"bash\ngo install github.com/"+f+"@latest\n"+CB;
  if(/rust/i.test(lang))return"## Installation\n\n"+CB+"bash\ncargo install --git https://github.com/"+f+"\n"+CB;
  return"## Installation\n\n"+CB+"bash\ngit clone https://github.com/"+f+".git\ncd "+n+"\n"+CB;
}

function usageSection(info,langs){
  const lang=info.language||Object.keys(langs||{})[0]||"";
  if(/javascript|typescript/i.test(lang))return"## Usage\n\n"+CB+"bash\nnode index.js\n"+CB;
  if(/python/i.test(lang))return"## Usage\n\n"+CB+"bash\npython main.py\n"+CB;
  return"## Usage\n\n"+CB+"bash\nmake run\n"+CB;
}

function genStandard(data,o,r,opts){
  const info=data.info;const s=[];
  s.push("# "+(info.full_name||o+"/"+r));
  s.push("> "+(info.description||"A "+(info.language||"")+" project."));
  s.push("");
  if(opts.badges)s.push(badges(info,o,r));
  s.push("");
  s.push("## Table of Contents");
  s.push("- [Features](#features)  - [Installation](#installation)  - [Usage](#usage)");
  s.push("- [Project Structure](#project-structure)  - [Contributing](#contributing)  - [License](#license)");
  s.push("");
  s.push("## Features");
  if(info.topics&&info.topics.length)info.topics.forEach(t=>s.push("- "+t.replace(/-/g," ").replace(/\b\w/g,c=>c.toUpperCase())));
  s.push("- Built with "+(info.language||"modern tech"));
  s.push("- Open source and actively maintained");
  if(info.stargazers_count>5)s.push("- Trusted by "+info.stargazers_count+"+ stargazers");
  s.push("");
  s.push(install(info,data.langs));
  s.push("");
  s.push(usageSection(info,data.langs));
  s.push("");
  if(opts.tree){s.push("## Project Structure");s.push(CB);s.push(treeStr(data.tree));s.push(CB);s.push("");}
  if(data.langs&&Object.keys(data.langs).length){
    s.push("## Tech Stack");
    const tot=Object.values(data.langs).reduce((a,b)=>a+b,0);
    for(const[l,b]of Object.entries(data.langs))s.push("- **"+l+"** ("+((b/tot)*100).toFixed(1)+"%)");
    s.push("");
  }
  s.push("## Contributing");
  s.push("Contributions welcome! Feel free to submit a Pull Request.");
  s.push("1. Fork  2. Branch  3. Commit  4. Push  5. PR");
  s.push("");
  s.push("## License");
  if(info.license&&info.license.spdx_id&&info.license.spdx_id!=="NOASSERTION")s.push(info.license.name);
  else s.push("See LICENSE file.");
  s.push("");
  s.push("---");
  s.push("Made with ❤ by ["+o+"](https://github.com/"+o+")");
  s.push("If this helped you, please ⭐ star this repo!");
  return s.join("\n");
}

function genMinimal(data,o,r,opts){
  const info=data.info;const s=[];
  s.push("# "+(info.full_name||o+"/"+r));
  s.push("");if(opts.badges)s.push(badges(info,o,r));s.push("");
  s.push(info.description||"");s.push("");
  s.push(install(info,data.langs));s.push("");
  s.push(usageSection(info,data.langs));s.push("");
  s.push("## License");
  if(info.license&&info.license.spdx_id!=="NOASSERTION")s.push(info.license.name);
  else s.push("See LICENSE file.");
  return s.join("\n");
}

function genFull(data,o,r,opts){
  let t=genStandard(data,o,r,opts);
  t+="\n## API Reference\nSee [API Docs](./docs/api.md).\n";
  t+="## Changelog\nSee [CHANGELOG.md](./CHANGELOG.md).\n";
  t+="## FAQ\n**Q: Report a bug?** A: Open an issue.\n";
  t+="## Support\nStar ⭐ this repo! Share it! Report bugs!\n";
  return t;
}

async function main(){
  const opts=parseArgs();
  const{owner,repo}=parseRepo(opts.repoUrl);
  log("\n"+C.bold+C.cyan+"GitHub README Beautifier"+C.reset+C.dim+" v1.0.0"+C.reset);
  const data=await fetchData(owner,repo,opts.token);
  const info=data.info;
  log("  "+C.green+"✓"+C.reset+" Stars: "+(info.stargazers_count||0));
  log("  "+C.green+"✓"+C.reset+" Language: "+(info.language||"N/A"));
  log("  "+C.green+"✓"+C.reset+" License: "+(info.license?info.license.spdx_id:"N/A"));
  let readme;
  switch(opts.template){
    case"minimal":readme=genMinimal(data,owner,repo,opts);break;
    case"full":readme=genFull(data,owner,repo,opts);break;
    default:readme=genStandard(data,owner,repo,opts);
  }
  if(opts.dryRun){console.log(readme);}
  else{
    fs.writeFileSync(opts.output,readme,"utf-8");
    log("\n"+C.green+"✓ Generated: "+opts.output+C.reset);
    log("  "+Buffer.byteLength(readme,"utf-8")+" bytes, "+readme.split("\n").length+" lines");
  }
  log(C.green+"Done!"+C.reset);
}

main().catch(e=>err(e.message));
