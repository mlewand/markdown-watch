
/**
 * Module Dependencies
 *
 * fs 						filesystem access
 * path 					domain + folder + extension manipulation
 * http 					http server
 *
 * _ 						array + collection tools
 * program 					cli tools to parse arguments, etc.
 * marked					markdown to html parser
 * Handlebars 				HTML templating module
 * HTMLtemplate 			Easy function to compile + return the html template
 * FileSocketCollection 	Object that stores all sockets and file watchers
 * info						package.json file as an object
 *
 */
var fs = require('fs'),
	path = require('path'),
	http = require('http'),
	_ = require('lodash'),
	program = require('commander'),
	marked = require('marked'),
	Handlebars = require('handlebars'),
	HTMLtemplate = Handlebars.compile( fs.readFileSync(path.join(__dirname, 'http/index.html'), {encoding: 'utf8'}) ),
	FileSocketCollection = require('./lib/FileSocketCollection'),
	info = require('./package.json');




var LiveFiles = new FileSocketCollection;


program
	.version( info.version )
	.option('-p --port <n>', 'HTTP listening port', parseInt, 8080);

program.parse(process.argv);









function isFileMarkdown( relativePath ) {
	var supportedExtensions = [ 'png', 'jpg', 'gif', 'jpeg' ],
		requestExtension = path.extname( relativePath ).length > 1 && path.extname( relativePath ).substr( 1 ).toLowerCase(),
		// Note if requestExtension is not present (false) it will still return -1.
		isMarkdown = supportedExtensions.indexOf( requestExtension ) === -1;

	return isMarkdown;
}









var server = http.createServer(function (req, res) {

	//var supportedExtensions = [ 'png', 'jpg', 'gif', 'jpeg' ],
	//	requestExtension = path.extname( req.url ).length > 1 && path.extname( req.url ).substr( 1 ).toLowerCase(),
	//	// Note if requestExtension is not present (false) it will still return -1.
	//	isMarkdown = supportedExtensions.indexOf( requestExtension ) === -1;
	var isMarkdown = isFileMarkdown( req.url );

	var filepath = path.join(process.cwd(), req.url),
		data = { port: program.port };

	if ( isMarkdown ) {
		filepath += '.md';
	}

	console.log( 'req for ', filepath, path.extname(req.url), isMarkdown );

	if ( fs.existsSync(filepath) ) {
		var fileContent = fs.readFileSync(filepath, {encoding: 'utf8'});
		res.statusCode = 200;	 // OK (202)

		if ( isMarkdown ) {
			res.setHeader('Content-Type', 'text/html');
			data.body = new Handlebars.SafeString( marked( fileContent ) );
		} else {
			res.setHeader('Content-Type', 'image/png');
			//data.body = fileContent;
			data.body = fs.readFileSync(filepath);
		}
	}
	else res.statusCode = 404;  // Not Found (404)

	//res.end( HTMLtemplate(data) );
	//res.setHeader('Content-Type', 'text/html');
	//res.end( isMarkdown ? HTMLtemplate( data ) : data );
	console.log( typeof fileContent );
	res.end( isMarkdown ? HTMLtemplate( data ) : data.body );
});























/** Setup the socket.io server that all
  * clients will use to be notified of
  * relevant file changes to trigger a
  * page reload when file is changed.
  */
var socketIO = require('socket.io').listen(server, {log: false});

socketIO.on('connection', function (socket) {

	/** When client connects, it sends a 'watch'
	  * event with a relative path to the desired
	  * file.
	  */
	socket.on('watch', function (filepath) {

		if ( !isFileMarkdown( filepath ) ) {
			console.log( filepath, 'is not a markdown, returning' );
			return false;
		}

		filepath = path.join(process.cwd(), filepath)
						.replace(path.extname(filepath), '')
						.concat('.md');

		try {
			LiveFiles.add(filepath, socket);
		}
		catch (error) {
			//socket.disconnect();
			socket.emit('reload');  // Reload will display 404 page. A bit hacky, but works for now...
		}

	});

});






server.listen(program.port, function () {

	console.log('Listening on port %s...', program.port);

});
