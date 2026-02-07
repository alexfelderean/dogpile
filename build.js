import * as esbuild from 'esbuild';
import fs from 'fs';
import path from 'path';

async function build() {
    console.log('Building game...');

    // Clean dist folder
    if (fs.existsSync('dist')) {
        try {
            fs.rmSync('dist', { recursive: true, force: true });
        } catch (e) {
            console.warn('Failed to clean dist folder (EBUSY), attempting to overwrite...');
        }
    }
    if (!fs.existsSync('dist')) {
        fs.mkdirSync('dist', { recursive: true });
    }

    // Bundle JS with aggressive minification
    await esbuild.build({
        entryPoints: ['src/main.js'],
        bundle: true,
        minify: true,
        drop: ['console', 'debugger'], // Remove console.log and debugger statements
        mangleProps: /^_/, // Mangle private properties starting with _
        outfile: 'dist/bundle.js',
        platform: 'browser',
        target: ['es2020'],
        format: 'iife',
        legalComments: 'none', // Remove license comments
        treeShaking: true
    });

    console.log('JS Bundled.');

    // Copy index.html and modify it
    let html = fs.readFileSync('index.html', 'utf8');
    // Replace module script with bundle script
    html = html.replace('<script type="module" src="src/main.js"></script>', '<script src="bundle.js"></script>');
    // Minify HTML: remove extra whitespace, newlines, and comments
    html = html
        .replace(/<!--[\s\S]*?-->/g, '') // Remove HTML comments
        .replace(/\s+/g, ' ') // Collapse whitespace
        .replace(/> </g, '><') // Remove space between tags
        .replace(/\s*{\s*/g, '{') // CSS minification
        .replace(/\s*}\s*/g, '}')
        .replace(/\s*;\s*/g, ';')
        .replace(/\s*:\s*/g, ':')
        .trim();
    fs.writeFileSync('dist/index.html', html);
    console.log('HTML copied and updated.');
    console.log('HTML copied and updated.');

    // Copy Assets (Levels)
    if (fs.existsSync('levels')) {
        fs.mkdirSync('dist/levels', { recursive: true });
        fs.cpSync('levels', 'dist/levels', { recursive: true, force: true });
        console.log('Levels copied.');
    }

    // Copy Assets (Textures)
    if (fs.existsSync('textures')) {
        fs.mkdirSync('dist/textures', { recursive: true });
        fs.cpSync('textures', 'dist/textures', { recursive: true, force: true });
        console.log('Textures copied.');
    }

    // Check size
    const items = fs.readdirSync('dist', { recursive: true });
    let totalSize = 0;
    for (const item of items) {
        const fullPath = path.join('dist', item);
        const stat = fs.statSync(fullPath);
        if (stat.isFile()) {
            totalSize += stat.size;
        }
    }

    console.log(`Build complete! Total size: ${(totalSize / 1024).toFixed(2)} KB`);

    // Check limit
    if (totalSize < 15 * 1024) {
        console.log('SUCCESS: Build is under 15KB!');
    } else {
        console.log('WARNING: Build is over 15KB.');
    }
}

build().catch((e) => {
    console.error(e);
    process.exit(1);
});
