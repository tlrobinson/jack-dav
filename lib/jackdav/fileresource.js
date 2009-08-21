var file = require("file"),
    sprintf = require("printf").sprintf,
    utils = require("jack/utils"),
    mimeType = require("jack/mime").mimeType,
    Resource = require("./resource").Resource,
    Directory = require("jack/dir").Directory,
    File = require("jack/file").File;

var STATUS = utils.HTTP_STATUS_MESSAGES;

var FileResource = exports.FileResource = function(path, options) {
    Resource.apply(this, arguments);
}

FileResource.prototype = new Resource("", {});

FileResource.prototype.children = function() {
    var that = this;
    return file.list(this.filePath).map(function(path) {
        return that.child(path);
    });
}

// Is this resource a collection?
FileResource.prototype.isCollection = function() {
    return file.isDirectory(this.filePath);
}

// Does this recource exist?
FileResource.prototype.exists = function() {
    return file.exists(this.filePath);
}
  
// Return the creation time.
FileResource.prototype.creationDate = function() {
    // FIXME
    return file.mtime(this.filePath);
    //return file.ctime(this.filePath);
}

// Return the time of last modification.
FileResource.prototype.lastModified = function() {
    return file.mtime(this.filePath);
}
  
// Set the time of last modification.
FileResource.prototype.setLastModified = function(time) {
    // FIXME
}

// Return an Etag, an unique hash value for this resource.
FileResource.prototype.etag = function() {
    // FIXME: inode
    return sprintf('%x-%x',
        file.size(this.filePath),
        Math.round(file.mtime(this.filePath).getTime()/1000)
    )
//    sprintf('%x-%x-%x', stat.ino, stat.size, stat.mtime.to_i)
}

// Return the resource type.
//
// If this is a collection, return
// REXML::Element.new('D:collection')
FileResource.prototype.resourceType = function() {
    if (this.isCollection())
        return document.createElement("D", "collection")
//    if collection?
//      REXML::Element.new('D:collection')
//  }
}

// Return the mime type of this resource.
FileResource.prototype.contentType = function() {
    if (file.isDirectory(this.filePath))
        return "text/html";
    else
        return mimeType(this.filePath);
//    if stat.directory?
//      "text/html"
//    else 
//      mime_type(this.filePath, DefaultMimeTypes)
//  }
}

// Return the size in bytes for this resource.
FileResource.prototype.contentLength = function() {
    return file.size(this.filePath);
//    stat.size
}

// HTTP GET request.
//
// Write the content of the resource to the response.body.
FileResource.prototype.GET = function(request, response) {
    if (file.isDirectory(this.filePath)) {
        Directory(this.root)(request.env)[2].forEach(function(chunk) {
            response.write(chunk);
        });
        response.setHeader('Content-Length', String(response.length));
    } else {
        // FIXME: return the input stream?
        response.write(File.read(this.filePath, { mode : "b" }));
    }
}

// HTTP PUT request.
//
// Save the content of the request.body.
FileResource.prototype.PUT = function(request, response) {
//    write(request.body)
}
  
// HTTP POST request.
//
// Usually forbidden.
FileResource.prototype.POST = function(request, response) {
    throw STATUS["Forbidden"];
}
  
// HTTP DELETE request.
//
// Delete this resource.
FileResource.prototype.DELETE = function() {
//    if stat.directory?
//      Dir.rmdir(this.filePath)
//    else
//      File.unlink(this.filePath)
//  }
}
  
// HTTP COPY request.
//
// Copy this resource to given destination resource.
FileResource.prototype.COPY = function(dest) {
//    if stat.directory?
//      dest.make_collection
//    else
//      open(this.filePath, "rb") do |file|
//        dest.write(file)
//    }
//  }
}

// HTTP MOVE request.
//
// Move this resource to given destination resource.
FileResource.prototype.MOVE = function(dest) {
//    copy(dest)
//    delete
}
  
// HTTP MKCOL request.
//
// Create this resource as collection.
FileResource.prototype.MKCOL = function() {
//    Dir.mkdir(this.filePath)
}

// Write to this resource from given IO.
FileResource.prototype.write = function(io) {
//    tempfile = "#{this.filePath}.#{Process.pid}.#{object_id}"
//    
//    open(tempfile, "wb") do |file|
//      while part = io.read(8192)
//        file << part
//    }
//  }
//
//    File.rename(tempfile, this.filePath)      
//  ensure
//    File.unlink(tempfile) rescue nil
}