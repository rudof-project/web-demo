# Give everyone without an age an unknown one, and rename Bob
PREFIX foaf: <http://xmlns.com/foaf/0.1/>
PREFIX : <http://example.org/>

INSERT { ?person foaf:age "unknown" }
WHERE {
  ?person a foaf:Person .
  FILTER NOT EXISTS { ?person foaf:age ?age }
} ;

DELETE { :bob foaf:name ?old }
INSERT { :bob foaf:name "Robert" }
WHERE  { :bob foaf:name ?old }
