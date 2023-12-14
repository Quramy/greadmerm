# greadmerm

Locally preview your markdown, Github style.

## Installation

via npm:

```sh
$ npm install -g greadmerm
```


## Usage

```
$ greadmerm [path/to/some.markdown]

   view your markdown at http://localhost:8124/
   press CTRL+C to quit
```

Execute `greadmerm` passing an optional path to a markdown file and it will be parsed and served from a locally running
http server with Github styling applied. When no file path is specified, `greadmerm` displays a file browser of the
current directory, similar to Github.


A browser will automatically be opened to preview the markdown if your OS supports it.


Files with the following extensions are rendered.

- .md
- .markdown


The default port is `8124` and the default host is `localhost`. You can change these settings by passing the `--port`
and `--host` option. For example:

```sh
$ greadmerm --host 127.0.0.0 --port 7220
```

## Notes

### Styling

An attempt is made to use the [Github markdown rendering api](http://developer.github.com/v3/markdown/) and Githubs stylesheets. If the attempt fails we fall back to rendering locally.

### Mermaid diagrams

[Mermaid diagrams](https://mermaid.js.org/) are also available.

```text
flowchart LR

greadmerm -- depends --> mermaid[@mermaid-js/mermaid-cli]
mermaid -- depends --> puppeteer
```

```mermaid
flowchart LR

greadmerm -- depends --> mermaid[@mermaid-js/mermaid-cli]
mermaid -- depends --> puppeteer
```

## Acknowledgment

This repository is forked from https://github.com/aheckmann/greadme .

## License

[MIT](https://github.com/quramy/greadmerm/blob/master/LICENSE)

