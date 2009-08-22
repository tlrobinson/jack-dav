JackDAV
=======

JackDAV is a WebDAV server implementation for [Jack](http://jackjs.org/), based on [RackDAV](http://www.matthias-georgi.de/2009/4/rackdav-web-authoring-for-rack).

JackDAV is a work in progress.

Getting Started
---------------

1. Follow the Narwhal [quick start guide](http://narwhaljs.org/quick-start.html)

2. Run `tusk install jack-dav` to install jack-dav (and [jack](http://jackjs.org/)).

3. Run `jackdav` to start up a jack-dav server for the current directory.

4. Open [http://localhost:8080/](http://localhost:8080/) with a WebDAV client (for example, in Mac OS X's Finder simply enter "command-k") or a web browser.

Status
------

* OPTIONS, HEAD, GET, PUT, POST, DELETE, PROPFIND, MKCOL, COPY, and MOVE are complete or mostly complete.
* PROPPATCH, LOCK, and UNLOCK are incomplete.
