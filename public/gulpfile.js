var gulp = require('gulp');
var gutil = require('gulp-util');
var source = require('vinyl-source-stream');
var browserify = require('browserify');
var watchify = require('watchify');
var browserSync = require('browser-sync').create();

function bundle (bundler) {
    return bundler
        .bundle()
        .on('error', function (e) {
            gutil.log(e.message);
        })
        .pipe(source('bundle.js'))
        .pipe(gulp.dest('./app/dist'))
        .pipe(browserSync.stream());
}

gulp.task('watch', function () {
    var watcher = watchify(browserify('./app/main.js', watchify.args));
    bundle(watcher);
    watcher.on('update', function () {
        bundle(watcher);
    });
    watcher.on('log', gutil.log);

    browserSync.init({
        server: './app',
        logFileChanges: false,
        https: {
            key: "../assets/key.pem",
            cert: "../assets/cert.pem"
        }
    });

    gulp.watch("app/*.html").on('change', browserSync.reload);
    gulp.watch("app/*.json").on('change', browserSync.reload);
    gulp.watch("app/css/*.css").on('change', browserSync.reload);
});

gulp.task('js', function () {
    return bundle(browserify('./app/js/app.js', watchify.args));
});