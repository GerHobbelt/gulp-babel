'use strict';
const path = require('path');
const PluginError = require('plugin-error');
const through = require('through2');
const applySourceMap = require('vinyl-sourcemaps-apply');
const replaceExt = require('replace-ext');
const babel = require('@gerhobbelt/babel-core');

function replaceExtension(fp) {
	return path.extname(fp) ? replaceExt(fp, '.js') : fp;
}

module.exports = function (opts) {
	opts = opts || {};

	return through.obj(function (file, enc, cb) {
		if (file.isNull()) {
			cb(null, file);
			return;
		}

		if (file.isStream()) {
			cb(new PluginError('gulp-babel', 'Streaming not supported'));
			return;
		}

		if (!supportsCallerOption()) {
			cb(
				new PluginError(
					'gulp-babel',
					'@gerhobbelt/babel-core@^7.0.0 is required'
				)
			);
			return;
		}

		const isInputSourceMapPresent = Boolean(file.sourceMap);
		const defaultOpts = {
			filename: file.path,
			filenameRelative: file.relative,
			caller: Object.assign({name: 'babel-gulp'}, opts.caller)
		};

		if (isInputSourceMapPresent) {
			defaultOpts.inputSourceMap = file.sourceMap;
		} else {
			defaultOpts.sourceFileName = file.relative;
		}

		const fileOpts = Object.assign({}, opts, defaultOpts);

		babel
			.transformAsync(file.contents.toString(), fileOpts)
			.then(res => {
				if (res) {
					if (file.sourceMap && res.map) {
						if (isInputSourceMapPresent) {
							file.sourceMap = res.map;
						} else {
							res.map.file = replaceExtension(file.relative);
							applySourceMap(file, res.map);
						}
					}

					file.contents = Buffer.from(res.code);
					file.path = replaceExtension(file.path);

					file.babel = res.metadata;
				}

				this.push(file);
			})
			.catch(error => {
				this.emit(
					'error',
					new PluginError('gulp-babel', error, {
						fileName: file.path,
						showProperties: false
					})
				);
			})
			.then(() => cb(), (err) => {
				console.error(`${err.name}: ${err.code}: ${err.message}`);
				cb();
			});
	});
};

// Note: We can remove this eventually, I'm just adding it so that people have
// a little time to migrate to the newer RCs of @gerhobbelt/babel-core without getting
// hard-to-diagnose errors about unknown 'caller' options.
let supportsCallerOptionFlag;
function supportsCallerOption() {
	if (supportsCallerOptionFlag === undefined) {
		try {
			// Rather than try to match the Babel version, we just see if it throws
			// when passed a 'caller' flag, and use that to decide if it is supported.
			babel.loadPartialConfig({
				caller: undefined,
				babelrc: false,
				configFile: false
			});
			supportsCallerOptionFlag = true;
		} catch (error) {
			supportsCallerOptionFlag = false;
		}
	}

	return supportsCallerOptionFlag;
}

/**
 * Handy pretty-printed log for errors.
 *
 * It emits 'end' to signal the task has ended, otherwise it would just abruptly exit gulp.
 * @param {Object} error - a gutil.PluginError
 */
module.exports.logError = function (error) {
	process.stderr.write(error.toString() + '\n' + error.codeFrame + '\n');
	this.emit('end');
};
