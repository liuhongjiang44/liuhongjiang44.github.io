---
title: 博客开张：Astro Retypeset + GitHub Actions
published: 2026-11-19
description: 这个博客基于 Astro 和 Retypeset 主题，内容放在 GitHub 仓库里，push 即发布。
tags:
  - 博客
  - Astro
abbrlink: hello-blog
---

这个博客的内容全部存放在 GitHub 仓库里，每次 push 到 `main` 后由 GitHub Actions 自动构建并发布到 GitHub Pages。主题是 [Retypeset](https://github.com/radishzzz/astro-theme-retypeset)，暗色模式下的星空背景移植自 [Vibe-UI](https://github.com/continue33/Vibe-UI) 的 constellation-field 组件。

## 写一篇新文章

在 `src/content/posts/` 下新建一个 `.md` 文件，开头写上：

```yaml
---
title: 文章标题
published: 2026-11-19
tags:
  - 标签1
---
```

然后：

```bash
git add . && git commit -m "new post" && git push
```

一两分钟后就会出现在站点上。
