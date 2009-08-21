var domImplementation = Packages.javax.xml.parsers.DocumentBuilderFactory.newInstance().newDocumentBuilder().getDOMImplementation(),
    transformerFactory = Packages.javax.xml.transform.TransformerFactory.newInstance(),
    serializer = transformerFactory.newTransformer();
    
serializer.setOutputProperty(Packages.javax.xml.transform.OutputKeys.VERSION, "1.0");
serializer.setOutputProperty(Packages.javax.xml.transform.OutputKeys.ENCODING, "UTF-8");
//serializer.setOutputProperty(Packages.javax.xml.transform.OutputKeys.STANDALONE, "no");
serializer.setOutputProperty(Packages.javax.xml.transform.OutputKeys.INDENT, "yes");

exports.createDocument = function(/*String*/ namespaceURI, /*String*/ qualifiedName, /*DocumentType*/ doctype)  {
    return domImplementation.createDocument(namespaceURI, qualifiedName, doctype) 
}

exports.XMLSerializer = function() {
}

exports.XMLSerializer.prototype.serializeToString = function(doc) {
    var domSource = new Packages.javax.xml.transform.dom.DOMSource(doc),
        stringWriter = new Packages.java.io.StringWriter(),
        streamResult = new Packages.javax.xml.transform.stream.StreamResult(stringWriter);
	
	serializer.transform(domSource, streamResult);
	
	return String(stringWriter.toString());
}
