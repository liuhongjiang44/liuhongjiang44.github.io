---
title: 博客开张：Jekyll Chirpy + GitHub Actions
date: 2026-11-19 12:00:00 +0800
categories: [技术学习, 博客]
tags: [jekyll, github]
---

这个博客的内容全部存放在 GitHub 仓库里，每次 push 到 `main` 后由 GitHub Actions 自动构建并发布到 GitHub Pages。

## 写一篇新文章

在 `_posts/` 下新建 `YYYY-MM-DD-标题.md`，开头写上：

```yaml
---
title: 文章标题
date: 2026-11-19 12:00:00 +0800
categories: [分类, 子分类]
tags: [标签1, 标签2]
---
```

然后：

```bash
git add . && git commit -m "new post" && git push
```

一两分钟后就会出现在站点上。
