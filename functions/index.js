const functions = require('firebase-functions');
const algoliasearch = require('algoliasearch');

const ALGOLIA_ID = functions.config().algolia.app_id;
const ALGOLIA_ADMIN_KEY = functions.config().algolia.api_key;
const ALGOLIA_SEARCH_KEY = functions.config().algolia.search_key;

const ALGOLIA_INDEX_NAME = 'titles';
const client = algoliasearch(ALGOLIA_ID, ALGOLIA_ADMIN_KEY);

exports.onTitleCreated = functions.firestore.document('titles/{titleId}').onCreate(event => {
  const title = event.data.data();

  title.objectID = event.params.titleId;

  const index = client.initIndex(ALGOLIA_INDEX_NAME);
  
  return index.saveObject(title);
});

const admin = require('firebase-admin');

admin.initializeApp(functions.config().firebase);

function getFirebaseUser(req, res, next) {
  console.log('Check if request is authorized with Firebase ID token');

  if (!req.headers.authorization
      || !req.headers.authorization.startsWith('Bearer ')) {
    console.error(
      'No Firebase ID token was passed as a Bearer token in the Authorization header.',
      'Make sure you authorize your request by providing the following HTTP header:',
      'Authorization: Bearer <Firebase ID Token>'
    );
    
    res.status(403).send('Unauthorized');
    
    return;
  }

  let idToken;
  
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer ')
  ) {
    console.log("Found 'Authorization' header");
    
    idToken = req.headers.authorization.split('Bearer ')[1];
  }

  admin
    .auth()
    .verifyIdToken(idToken)
    .then(decodedIdToken => {
      console.log('ID Token correctly decoded', decodedIdToken);
      req.user = decodedIdToken;
      next();
    })
    .catch(error => {
      console.error('Error while verifying Firebase ID token:', error);
      res.status(403).send('Unauthorized');
    });
}

const app = require('express')();

app.use(require('cors')({ origin: true }));
app.use(getFirebaseUser);
app.get('/', (req, res) => {
  const params = {
    filters: `author:${req.user.user_id}`,
    userToken: req.user.user_id
  };

  const key = client.generateSecuredApiKey(ALGOLIA_SEARCH_KEY, params);

  res.json({ key });
});

exports.getSearchKey = functions.https.onRequest(app);
