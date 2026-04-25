cd C:\tmp\note-toc-extension

git init
git branch -M main

git remote remove origin 2>$null
git remote add origin https://github.com/daccot/note-TOC-Exporter.git

@"
node_modules/
*.log
*.tmp
*.zip
*.crx
.DS_Store
"@ | Out-File -Encoding utf8 .gitignore

git add .
git commit -m "Initial import from local note TOC extension"

git pull origin main --allow-unrelated-histories
git push -u origin main