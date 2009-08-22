var documentBuilder = Packages.javax.xml.parsers.DocumentBuilderFactory.newInstance().newDocumentBuilder(),
    domImplementation = documentBuilder.getDOMImplementation(),
    transformerFactory = Packages.javax.xml.transform.TransformerFactory.newInstance();

transformerFactory.setAttribute("indent-number", new Packages.java.lang.Integer(2));

var serializer = transformerFactory.newTransformer();
serializer.setOutputProperty(Packages.javax.xml.transform.OutputKeys.VERSION, "1.0");
serializer.setOutputProperty(Packages.javax.xml.transform.OutputKeys.ENCODING, "UTF-8");
//serializer.setOutputProperty(Packages.javax.xml.transform.OutputKeys.STANDALONE, "no");
serializer.setOutputProperty(Packages.javax.xml.transform.OutputKeys.INDENT, "yes");

exports.createDocument = function(/*String*/ namespaceURI, /*String*/ qualifiedName, /*DocumentType*/ doctype)  {
    var doc = domImplementation.createDocument(namespaceURI, qualifiedName, doctype || null);
    return doc;
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

// DOMParser
var validContentTypes = { "text/xml" : true, "application/xml" : true, "application/xhtml+xml" : true };

var DOMParser = exports.DOMParser = function() {
}

DOMParser.prototype.parseFromString = function(/*String*/ text, /*String*/ contentType) {
    if (validContentTypes[contentType] !== true)
        throw new Error("DOMParser parseFromString() contentType argument must be one of text/xml, application/xml or application/xhtml+xml");
    
    return documentBuilder.parse(new Packages.org.xml.sax.InputSource(new Packages.java.io.StringReader(text)));
}

// misc:

// FIXME: wrap Document so we can add these:

exports.createExpression = function(/*String*/ xpathText, /*Function*/ namespaceURLMapper) {
    return new XPathExpression(xpathText, namespaceURLMapper);
}

exports.evaluate = function(/*String*/ xpathText, /*Node*/ contextNode, /*Function*/ namespaceURLMapper, /*short*/ resultType, /*XPathResult*/ result) {
    return exports.createExpression(xpathText, namespaceURLMapper).evaluate(contextNode, resultType, result);
}

// XPathExpression:

var xpathFactory = Packages.javax.xml.xpath.XPathFactory.newInstance();//namespaceURI);
    
var XPathExpression = exports.XPathExpression = function(/*String*/ xpathText, /*Function*/ namespaceURLMapper) {
    var namespaceContext = null;
    if (typeof namespaceURLMapper === "function") {
        namespaceContext = function(prefix, methodName) {
            if (methodName === "getNamespaceURI")
                return namespaceURLMapper(String(prefix));
            return null;
        }
    }

    this.xpath = xpathFactory.newXPath();
    if (namespaceContext)
        this.xpath.setNamespaceContext(namespaceContext);
    
    this.xpathExpression = this.xpath.compile(xpathText);
}

XPathExpression.prototype.evaluate = function(/*Node*/ contextNode, /*short*/ resultType, /*XPathResult*/ result) {
    var nodes = null;
    if (resultType === undefined || resultType === null || QNameMapping[resultType] === null)
        nodes = this.xpathExpression.evaluate(contextNode);
    else if (QNameMapping[resultType] === undefined)
        throw new Error("Invalid resultType");
    else
        nodes = this.xpathExpression.evaluate(contextNode, QNameMapping[resultType]);

    if (!result)
        result = new XPathResult();
    
    result._setResult(nodes, resultType);
    
    return result;
}

// XPathResult:

var XPathResult = exports.XPathResult = function() {
}

XPathResult.prototype._setResult = function(result, resultType) {
    delete this.booleanValue;
    delete this.numberValue;
    delete this.stringValue;
    delete this.singleNodeValue;
    
    delete this.resultType;
    
    delete this.snapshotLength;
    delete this.invalidIteratorState;
    
    delete this._snapshot;
    delete this._iteratorIndex;
    
    if (result instanceof Packages.java.lang.Boolean) {
        this.booleanValue = Boolean(result);
        this.resultType = XPathResult.BOOLEAN_TYPE;
    }
    else if (result instanceof  Packages.java.lang.Number) {
        this.numberValue = Number(result);
        this.resultType = XPathResult.NUMBER_TYPE;
    }
    else if (result instanceof  Packages.java.lang.String) {
        this.stringValue = String(result);
        this.resultType = XPathResult.STRING_TYPE;
    }
    else if (result instanceof Packages.org.w3c.dom.Node) {
        this.singleNodeValue = result;
        switch (resultType) {
            case XPathResult.ANY_UNORDERED_NODE_TYPE:
            case XPathResult.FIRST_ORDERED_NODE_TYPE:
                this.resultType = resultType;
            default:
                this.resultType = XPathResult.ANY_UNORDERED_NODE_TYPE;
        }
    }
    else if (result instanceof Packages.org.w3c.dom.NodeList) {
        this._snapshot = result;
        this._iteratorIndex = 0;
        this.snapshotLength = result.getLength();
        this.invalidIteratorState = false;
        switch (resultType) {
            case XPathResult.UNORDERED_NODE_ITERATOR_TYPE:
            case XPathResult.ORDERED_NODE_ITERATOR_TYPE:
            case XPathResult.UNORDERED_NODE_SNAPSHOT_TYPE:
            case XPathResult.ORDERED_NODE_SNAPSHOT_TYPE:
                this.resultType = resultType;
            default:
                this.resultType = XPathResult.UNORDERED_NODE_ITERATOR_TYPE;
        }
    } else {    
        this._iteratorIndex = 0;
        this.snapshotLength = 0;
        this.invalidIteratorState = false;
        this.resultType = XPathResult.UNORDERED_NODE_ITERATOR_TYPE;
    }
}

XPathResult.prototype.iterateNext = function() {
    return this.snapshotItem(this._iteratorIndex++);
}

XPathResult.prototype.snapshotItem = function(index) {
    return (index >= this.snapshotLength) ? null : this._snapshot.item(index); 
}

XPathResult.ANY_TYPE = 0;
XPathResult.NUMBER_TYPE = 1;
XPathResult.STRING_TYPE = 2;
XPathResult.BOOLEAN_TYPE = 3;
XPathResult.UNORDERED_NODE_ITERATOR_TYPE = 4;
XPathResult.ORDERED_NODE_ITERATOR_TYPE = 5;
XPathResult.UNORDERED_NODE_SNAPSHOT_TYPE = 6;
XPathResult.ORDERED_NODE_SNAPSHOT_TYPE = 7;
XPathResult.ANY_UNORDERED_NODE_TYPE = 8;
XPathResult.FIRST_ORDERED_NODE_TYPE = 9;

var QNameMapping = {};
QNameMapping[XPathResult.ANY_TYPE]                      = null;
QNameMapping[XPathResult.NUMBER_TYPE]                   = Packages.javax.xml.xpath.XPathConstants.NUMBER;
QNameMapping[XPathResult.STRING_TYPE]                   = Packages.javax.xml.xpath.XPathConstants.STRING;
QNameMapping[XPathResult.BOOLEAN_TYPE]                  = Packages.javax.xml.xpath.XPathConstants.BOOLEAN;
QNameMapping[XPathResult.UNORDERED_NODE_ITERATOR_TYPE]  = Packages.javax.xml.xpath.XPathConstants.NODESET;
QNameMapping[XPathResult.ORDERED_NODE_ITERATOR_TYPE]    = Packages.javax.xml.xpath.XPathConstants.NODESET;
QNameMapping[XPathResult.UNORDERED_NODE_SNAPSHOT_TYPE]  = Packages.javax.xml.xpath.XPathConstants.NODESET;
QNameMapping[XPathResult.ORDERED_NODE_SNAPSHOT_TYPE]    = Packages.javax.xml.xpath.XPathConstants.NODESET;
QNameMapping[XPathResult.ANY_UNORDERED_NODE_TYPE]       = Packages.javax.xml.xpath.XPathConstants.NODE;
QNameMapping[XPathResult.FIRST_ORDERED_NODE_TYPE]       = Packages.javax.xml.xpath.XPathConstants.NODE;


exports.Node = Packages.org.w3c.dom.Node;
exports.Element = Packages.org.w3c.dom.Element;
exports.NodeList = Packages.org.w3c.dom.NodeList;
exports.Document = Packages.org.w3c.dom.Document;
