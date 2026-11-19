---
title: 博客开张：Hexo + AnZhiYu + GitHub Actions
date: 2026-11-19 12:00:00
categories:
  - 技术学习
tags:
  - Hexo
  - GitHub
cover:
---

这个博客的内容全部存放在 GitHub 仓库里，每次 push 后由 GitHub Actions 自动构建并发布到 GitHub Pages。

## 写一篇新文章

```bash
npx hexo new post "文章标题"
```

在 `source/_posts/` 里编辑 Markdown，然后：

```bash
git add . && git commit -m "new post" && git push
```

一两分钟后就会出现在站点上。
