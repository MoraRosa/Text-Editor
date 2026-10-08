<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Keep the editor as standalone HTML, CSS, and JavaScript under public/writer; the required TanStack index only embeds it so editor behavior has no framework or backend dependency.
- Define editor appearance and theme colors in writer.css; use its shared control classes and tokens throughout the vanilla editor.
- Store drafts locally and sanitize both pasted and restored HTML, because this editor is deliberately device-only with no Cloud connection.
