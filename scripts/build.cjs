const fs=require('node:fs');const path=require('node:path');
const root=path.join(__dirname,'..'),out=path.join(root,'dist');
fs.rmSync(out,{recursive:true,force:true});fs.mkdirSync(out,{recursive:true});
fs.copyFileSync(path.join(root,'index.html'),path.join(out,'index.html'));
fs.cpSync(path.join(root,'assets'),path.join(out,'assets'),{recursive:true});
fs.mkdirSync(path.join(out,'docs'));for(const file of fs.readdirSync(path.join(root,'docs')).filter(x=>x.endsWith('.html')))fs.copyFileSync(path.join(root,'docs',file),path.join(out,'docs',file));
fs.writeFileSync(path.join(out,'.nojekyll'),'');console.log('Static site built in dist/');
