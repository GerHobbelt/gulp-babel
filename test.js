'use strict';
const path = require('path');
const assert = require('assert');
const Vinyl = require('vinyl');
const sourceMaps = require('gulp-sourcemaps');
const babel = require('.');

it('should transpile with Babel', cb => {
	const stream = babel({
		plugins: ['@gerhobbelt/babel-plugin-transform-block-scoping']
	});
	let collectedData = '';

	stream.on('data', file => {
		assert(/var foo/.test(file.contents.toString()), file.contents.toString());
		assert.strictEqual(file.relative, 'fixture.js');
		collectedData += file.contents.toString();
	});

	stream.on('end', () => {
		assert(collectedData.length > 0);
		cb();
	});

	stream.write(
		new Vinyl({
			cwd: __dirname,
			base: path.join(__dirname, 'fixture'),
			path: path.join(__dirname, 'fixture/fixture.jsx'),
			contents: Buffer.from('let foo;')
		})
	);

	stream.end();
});

it('should barf a hairball when babel config is wrong (plugins)', cb => {
	const stream = babel({
		plugins: ['transform-block-scoping']
	});
	let hitCount = 0;

	stream.on('data', file => {
	});

	stream.on('error', err => {
		assert(err.message.indexOf('Cannot find module') >= 0, `Unexpected error: ${err.message}`);
		hitCount++;
	});

	stream.on('end', () => {
		assert(hitCount > 0);
		cb();
	});

	stream.write(
		new Vinyl({
			cwd: __dirname,
			base: path.join(__dirname, 'fixture'),
			path: path.join(__dirname, 'fixture/fixture.jsx'),
			contents: Buffer.from('let foo;')
		})
	);

	stream.end();
});

it('should generate source maps', cb => {
	const init = sourceMaps.init();
	const write = sourceMaps.write();
	init
		.pipe(
			babel({
				plugins: ['@gerhobbelt/babel-plugin-transform-arrow-functions']
			})
		)
		.pipe(write);

	write.on('data', file => {
		assert.strictEqual(file.sourceMap.file, 'fixture.js');
		const contents = file.contents.toString();
		assert(/function/.test(contents));
		assert(/sourceMappingURL/.test(contents));
		assert.deepStrictEqual(file.sourceMap.sources, ['fixture.es2015']);
	});

	write.on('error', err => {
		console.error(err);
		assert.fail(`Unexpected error: ${err.message}`);
	});

	write.on('end', cb);

	init.write(
		new Vinyl({
			cwd: __dirname,
			base: path.join(__dirname, 'fixture'),
			path: path.join(__dirname, 'fixture/fixture.es2015'),
			contents: Buffer.from('[].map(v => v + 1)'),
			sourceMap: ''
		})
	);

	init.end();
});

it('should generate source maps for file in nested folder', cb => {
	const init = sourceMaps.init();
	const write = sourceMaps.write();
	init
		.pipe(
			babel({
				plugins: ['@gerhobbelt/babel-plugin-transform-arrow-functions']
			})
		)
		.pipe(write);

	write.on('data', file => {
		assert.strictEqual(file.sourceMap.file, 'nested/fixture.js');
		const contents = file.contents.toString();
		assert(/function/.test(contents));
		assert(/sourceMappingURL/.test(contents));
		assert.deepStrictEqual(file.sourceMap.sources, ['nested/fixture.es2015']);
	});

	write.on('error', err => {
		console.error(err);
		assert.fail(`Unexpected error: ${err.message}`);
	});

	write.on('end', cb);

	init.write(
		new Vinyl({
			cwd: __dirname,
			base: path.join(__dirname, 'fixture'),
			path: path.join(__dirname, 'fixture/nested/fixture.es2015'),
			contents: Buffer.from('[].map(v => v + 1)'),
			sourceMap: ''
		})
	);

	init.end();
});

it('should pass the result of transform().metadata in file.babel', cb => {
	const stream = babel({
		plugins: [
			{
				post(file) {
					file.metadata.test = 'metadata';
				}
			}
		]
	});

	stream.on('data', file => {
		assert.deepStrictEqual(file.babel, {test: 'metadata'});
	});

	stream.on('end', cb);

	stream.write(
		new Vinyl({
			cwd: __dirname,
			base: path.join(__dirname, 'fixture'),
			path: path.join(__dirname, 'fixture/fixture.js'),
			contents: Buffer.from('class MyClass {};')
		})
	);

	stream.end();
});

it('should not rename ignored files', cb => {
	const stream = babel({
		ignore: [/fixture/]
	});

	const inputFile = {
		cwd: __dirname
	};

	inputFile.base = path.join(inputFile.cwd, 'fixture');
	inputFile.basename = 'fixture.jsx';
	inputFile.path = path.join(inputFile.base, inputFile.basename);
	inputFile.contents = Buffer.from(';');

	stream
		.on('data', file => {
			assert.strictEqual(file.relative, inputFile.basename);
		})
		.on('end', cb)
		.end(new Vinyl(inputFile));
});

it('should not rename files without an extension', cb => {
	const stream = babel();

	const inputFile = {
		cwd: __dirname
	};

	inputFile.base = path.join(inputFile.cwd, 'bin');
	inputFile.basename = 'app';
	inputFile.path = path.join(inputFile.base, inputFile.basename);
	inputFile.contents = Buffer.from(';');

	stream
		.on('data', file => {
			assert.strictEqual(file.relative, inputFile.basename);
		})
		.on('end', cb)
		.end(new Vinyl(inputFile));
});
