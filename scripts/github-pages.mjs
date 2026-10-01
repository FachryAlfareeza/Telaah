import {spawnSync} from 'node:child_process';
import {mkdtempSync,rmSync,rmdirSync,writeFileSync,existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';

const repo='FachryAlfareeza/Telaah';
function git(args,options={}) {
  const result=spawnSync('git',args,{encoding:'utf8',timeout:120000,env:{...process.env,GIT_TERMINAL_PROMPT:'0',GCM_INTERACTIVE:'never'},...options});
  if(result.status!==0)throw Error(`Git ${args[0]} failed: ${result.stderr||result.error?.message||'unknown error'}`);
  return result.stdout.trim();
}
// Obtain credentials through the configured Git helper; never print or write them.
const credential=git(['credential','fill'],{input:'protocol=https\nhost=github.com\n\n'});
const token=credential.split('\n').find(line=>line.startsWith('password='))?.slice(9);
if(!token)throw Error('No GitHub credential is available through Git.');
async function api(path,method='GET',body) {
  const response=await fetch(`https://api.github.com/repos/${repo}${path}`,{method,headers:{Authorization:`Bearer ${token}`,Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28','Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});
  const text=await response.text();let data;try{data=JSON.parse(text);}catch{data={};}
  if(!response.ok&&response.status!==404)throw Error(`GitHub API ${response.status}: ${data.message||'request failed'}`);
  return {status:response.status,data};
}
const command=process.argv[2]||'status';
if(command==='status') {
  const repository=await api(''),pages=await api('/pages');
  console.log(JSON.stringify({repository:{private:repository.data.private,defaultBranch:repository.data.default_branch,permissions:repository.data.permissions},pages:{status:pages.status,url:pages.data.html_url,buildStatus:pages.data.status,source:pages.data.source,buildType:pages.data.build_type}},null,2));
} else if(command==='deploy') {
  if(!existsSync('dist/index.html'))throw Error('Run npm run build:pages first.');
  writeFileSync('dist/.nojekyll','');
  const remote=git(['remote','get-url','origin']);
  if(remote!==`https://github.com/${repo}.git`)throw Error('Unexpected Git remote.');
  const parent=git(['ls-remote','origin','refs/heads/gh-pages']).split(/\s/)[0];
  if(parent)git(['fetch','origin','gh-pages']);
  const temp=mkdtempSync(join(tmpdir(),'telaah-pages-'));
  try {
    const env={...process.env,GIT_INDEX_FILE:join(temp,'index'),GIT_TERMINAL_PROMPT:'0',GCM_INTERACTIVE:'never'};
    git(['read-tree','--empty'],{env});
    git(['--work-tree',resolve('dist'),'add','--all'],{env});
    const tree=git(['write-tree'],{env});
    console.log('Publishing files:\n'+git(['ls-tree','-r','--name-only',tree]));
    const commit=git(['commit-tree',tree,...(parent?['-p',parent]:[]),'-m','Deploy Telaah browser demo to GitHub Pages']);
    git(['push','origin',`${commit}:refs/heads/gh-pages`]);
    const current=await api('/pages');
    const configured=await api('/pages',current.status===404?'POST':'PUT',{build_type:'legacy',source:{branch:'gh-pages',path:'/'}});
    console.log(JSON.stringify({commit,pagesConfigured:configured.status,url:configured.data.html_url||`https://fachryalfareeza.github.io/Telaah/`}));
  } finally {rmSync(join(temp,'index'),{force:true});rmdirSync(temp);}
} else if(command==='build') {
  const result=await api('/pages/builds/latest');console.log(JSON.stringify({status:result.status,build:result.data.status,error:result.data.error,commit:result.data.commit},null,2));
} else throw Error('Use status, deploy, or build.');
