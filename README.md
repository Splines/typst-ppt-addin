<div align="center">
  <a href="https://mampf.mathi.uni-heidelberg.de/">
    <img src="https://github.com/user-attachments/assets/07745d89-fde6-4347-84ba-9a78c164d870"
      width="130px" alt="PPTypst Logo"/>
  </a>

  <div align="center">
    <h3 align="center">PPTypst</h3>
    <p>
      <strong>Bring <a href="https://typst.app">Typst</a> to PowerPoint</strong><br>
      <sub><i>This community project is not affiliated with or endorsed by Typst.</i></sub>
    </p>
  </div>
</div>

> [!Important]
> This is currently an early preview while the first PoC is being improved on, to then ship the PowerPoint Add-in to the Marketplace. Expect a first release mid/end-February.

PPTypst brings the power of [Typst](https://typst.app) to PowerPoint. Easily insert formulas with live preview, update them, and even generate from a file.

<https://github.com/user-attachments/assets/3cb307af-4c02-4665-8f2c-34c23c6f68fc>

<sub>Maybe we can even integrate packages from the [Typst Universe](https://typst.app/universe/) in the future, vote for [this issue](https://github.com/Myriad-Dreamin/typst.ts/issues/825) or provide a PR if you have a solution in mind ;)</sub>

### ✨ How it works & Developing

See the [Dev Guide](DEV.md).

### 🎈 About

The first proof-of-concept came from Johannes Berger [here](https://github.com/johannesber/typst-ppt-addin) in January 2026. I forked the repo and have since been building on it, replacing the custom engine by [`typst.ts`](https://github.com/Myriad-Dreamin/typst.ts), migrating TypeScript, improving on code quality, as well as polishing and adding a lot more functionality. If you have any feature requests or want to report a bug, head over to the [issues](https://github.com/Splines/pptypst/issues).
