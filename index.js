
module.exports = function(store) {

  store.hook = function(method, pattern, fn) {
    var emitter = store.backend || store.shareClient;

    emitter.use('after submit', function(shareRequest, next) {
      var collectionName, firstDot, fullPath, matches, regExp, relPath, segments, op;

      var opData = shareRequest.opData || shareRequest.op;

      if (opData.del || opData.create) {
        collectionName = pattern;
        if (collectionName !== shareRequest.collection) return next();
      } else {
        firstDot = pattern.indexOf('.');
        if (firstDot === -1) {
          if (!patternToRegExp(pattern).test(shareRequest.collection)) return next();
        } else {
          collectionName = pattern.slice(0, firstDot);
          if (collectionName !== shareRequest.collection) return next();
        }
      }

      var snapshot = shareRequest.snapshot;
      var docName = shareRequest.docName || shareRequest.id;
      var backend = shareRequest.backend;
      var session = shareRequest.agent.connectSession;

      switch (method) {
        case 'del':
          if (!opData.del) return next();
          fn(docName, shareRequest, session, backend);
          break;
        case 'create':
          if (!opData.create) return next();
          fn(docName, shareRequest.snapshot.data, session, backend);
          break;
        case 'change':
          var ops = opData.op;
          if (ops) {
            for (var i = 0; i < ops.length; i++) {
              op = ops[i];
              segments = op.p;
              if (op.si || op.sd) segments = segments.slice(0, -1);

              relPath = segments.join('.');
              fullPath = collectionName + '.' + docName + '.' + relPath;
              regExp = patternToRegExp(pattern);
              matches = regExp.exec(fullPath);
              if (matches) {
                fn.apply(null, Array.prototype.slice.call(matches.slice(1)).concat([lookup(segments, snapshot.data)], [op], [session], [backend]));
              }
            }
          }
      }
      next();
    });

  };

  store.onQuery = function(collectionName, cb) {
    var emitter = store.backend || store.shareClient;

    emitter.use('query', function(shareRequest, next) {

      var session = shareRequest.agent.connectSession;

      if (collectionName === '*') {
        return cb(shareRequest.collection, shareRequest.query, session, next);
      }

      if (shareRequest.collection !== collectionName) return next();

      cb(shareRequest.query, session, next);

    });
  };

};


function patternToRegExp(pattern) {
  var end;
  end = pattern.slice(pattern.length - 2, pattern.length);
  if (end === '**') {
    pattern = pattern.slice(0, pattern.length - 2);
  } else {
    end = '';
  }
  pattern = pattern.replace(/\./g, "\\.").replace(/\*/g, "([^.]*)");
  return new RegExp(pattern + (end ? '.*' : '$'));
};

function lookup(segments, doc) {
  var curr, part, _i, _len;
  curr = doc;
  for (_i = 0, _len = segments.length; _i < _len; _i++) {
    part = segments[_i];
    if (curr !== void 0) {
      curr = curr[part];
    }
  }
  return curr;
};
