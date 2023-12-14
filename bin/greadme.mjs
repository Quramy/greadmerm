#!/usr/bin/env node

import * as path from 'node:path';
import * as fs from 'node:fs';
import * as http from 'node:http';
import { fileURLToPath } from 'node:url';
import fetch from 'node-fetch';
import express from 'express';
import { marked as md } from 'marked';
import open from 'open';
import favicon from 'express-favicon-short-circuit';
import { renderMermaid } from '@mermaid-js/mermaid-cli';
import puppeteer from 'puppeteer';

const cssPath = fileURLToPath(new URL('../css', import.meta.url));
const viewPath = fileURLToPath(new URL('../view.ejs', import.meta.url));

var app = express();
app.set('view engine', 'ejs');

process.title = 'greadme';

var args = process.argv.slice();
var host;
var port;
var pIndex;

if (~(pIndex = args.indexOf('--port'))) {
  port = args[pIndex + 1];
  // remove port arguments
  args.splice(pIndex, 2);
} else {
  port = 8124;
}

if (~(pIndex = args.indexOf('--host'))) {
  host = args[pIndex + 1];
  // remove port arguments
  args.splice(pIndex, 2);
} else {
  host = 'localhost';
}


var fileArg = args[2];

const css = await getStyle();

const renderedDiagrams = new Map();

app.use(favicon);
app.use('/css', express.static(cssPath))
app.use('/__diagram__', function (req, res, next) {
  const key = req.url.substring(1)
  if (renderedDiagrams.has(key)) {
    const { data, contentType } = renderedDiagrams.get(key)
    res.set('Content-Type', contentType)
    res.send(data);
  } else {
    next(new Error('diagram is not rendered'));
  }
});
app.use(function (req, res, next) {
  if (fileArg) {
    render(fs.readFileSync(path.join(process.cwd(), fileArg), 'utf8'), function (err, markdown) {
      if (err) return next(err);
      res.render(viewPath, {
        css: css,
        markdown: markdown,
        dir: false
      });
    });
  } else {
    var p = path.join(process.cwd(), req.url.substring(1));
    var stat = fs.statSync(p);
    if (stat.isFile() && p.indexOf('md') === -1 && p.indexOf('markdown') === -1) {
      res.sendfile(p);
    }
    var dir = stat.isDirectory();
    var file = dir ? readme(p) : p;
    var contents = file ? fs.readFileSync(file, 'utf8') : 'No readme found';
    processMermaidContent(contents).then((processedContents) => {
      render(processedContents, function (err, markdown) {
        if (err) return next(err);
        res.render(viewPath, {
          css: css,
          markdown: markdown,
          dir: dir && listDir(p)
        });
      });
    }).catch(err => next(err));
  }
});
var server = http.createServer(app).listen(port, host);

server.on('listening', function () {
  var url = 'http://' + host + ':' + port;
  console.log("\n  view your markdown at \u001B[32m%s/\u001B[0m", url);
  console.log('  press CTRL+C to quit');

  open(url, function (err) {
    // ignore errors
  });
});


function readme (dir) {
  var exts = 'markdown md'.split(' ');
  var file;
  var names = 'README Readme readme'.split(' ');
  if (names.some(function (name) {
    return exts.some(function (ext) {
      try {
        var filename = dir + '/' + name + '.' + ext;
        var stat = fs.statSync(filename);
        file = filename;
        return true;
      } catch (err) {
        return false;
      }
    });
  })) {
    return file;
  }
}

async function getStyle() {
  try {
    const res = await fetch('https://github.com/aheckmann/greadme', { timeout: 4000, headers: { 'user-agent': 'greadmerm' } });

    if (!res.ok) {
      // Go to the error handler
      throw new Error();
    }

    const body = await res.text();

    return [...body.matchAll(/href=["']([^"']+\.css)/g)].map(result => result[1]);
  } catch {
    // ignore error, use old css instead
    console.log('\u001B[35m  %s\u001B[0m', 'could not retreive latest github css. using old version');
    return ['/css/style.css'];
  }
}

function listDir (dir) {
  var all = fs.readdirSync(dir);
  var md = [];
  var dirs = dir == process.cwd() ? [] : ['..'];
  all.forEach(function (item) {
    var stat = fs.statSync(path.join(dir, item));
    if (stat.isDirectory()) {
      dirs.push(item);
    } else if (stat.isFile() && (/\.md$/.test(item) || /\.markdown$/.test(item))) {
      md.push(item);
    }
  });
  function canonical (item) {
    return {
      href: path.join(dir, item).replace(process.cwd(), '').replace(/\\/g, '/') || '/',
      name: item
    };
  }
  return {
    md: md.map(canonical),
    dirs: dirs.map(canonical)
  };
}

var browser;
async function processMermaidContent(contents) {
  const mermaidChartsInMarkdown = /^[^\S\n]*```(?:mermaid)([^\S\n]*\r?\n([\s\S]*?))```[^\S\n]*$/;
  const mermaidChartsInMarkdownRegexGlobal = new RegExp(mermaidChartsInMarkdown, 'gm');
  const parseMMDOptions = { backgroundColor: 'white', mermaidConfig: { useMaxWidth: false } };

  if (!browser) {
    browser = await puppeteer.launch({ headless: 'new' });
  }

  const images = [];
  for (const mermaidCodeblockMatch of contents.matchAll(mermaidChartsInMarkdownRegexGlobal)) {
    const mermaidDefinition = mermaidCodeblockMatch[2];
    const index = images.length;
    const key = `diagram-${index}.svg`;
    const cache = renderedDiagrams.get(key);
    if (!cache || cache.mermaidDefinition !== mermaidDefinition) {
      images.push(renderMermaid(browser, mermaidDefinition, 'svg').then(({ title = `diagram_${index}`, data }) => {
        const svgText = data.toString().replace(/viewBox="([^"]*)"/, (hit, vb) => `${hit} height="${vb.split(" ").pop()}"`);
        renderedDiagrams.set(key, {
          title,
          data: svgText,
          contentType: 'image/svg+xml',
          mermaidDefinition,
        });
        return { title, key };
      }).catch(err => {
        console.log(err);
        const errorText = (err?.message ?? ('Unknown error occurs during rendering diagram: \n' + mermaidDefinition))
          .replace(/Evaluation failed:/, '').replaceAll(/^\s+at\s.*$/gm, '').trim();
        return { key, errorText };
      }));
    } else {
      images.push(Promise.resolve({ title: cache.title, key }));
    }
  }
  const resolvedImages = await Promise.all(images)
  const processedContents = contents.replace(mermaidChartsInMarkdownRegexGlobal, () => {
    const { key, title, errorText } = resolvedImages.shift();
    if (errorText) {
      return `<pre>${errorText}</pre>`
    }
    return `<div align="center"><img src="/__diagram__/${key}" alt="${title}"></div>`;
  });

  return processedContents;
}

function render (fileContent, cb) {
  fetch('https://api.github.com/markdown/raw', {
    method: 'POST',
    body: fileContent,
    headers: {
      'content-type': 'text/plain',
      'user-agent': 'greadme'
    },
    timeout: 2000
  })
  .then(res => {
    if (!res.ok) {
      throw new Error('Received ' + res.status + ' status from the GitHub API');
    }
    return res.text();
  })
  .then(
    body => cb(null, body),
    err => {
      console.log(err);
      cb(null, md(fileContent));
    }
  );
}
