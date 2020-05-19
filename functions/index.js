const functions = require('firebase-functions');
const express = require('express');
const cors = require('cors');
const path = require('path');
const admin = require('firebase-admin');
const app = express();
var bodyParser = require('body-parser');

// api function
exports.api = functions.https.onRequest(app);

//app.use(cors({origin:true}));
admin.initializeApp({
	  credential: admin.credential.applicationDefault(),
	  databaseURL: 'https://toodles-744da.firebaseio.com/'
});


const authenticate = async(req,res,next) => {
	if(!req.headers.authorization || !req.headers.authorization.startsWith('Bearer'))
	{
		console.log(req.headers.authorization);
		res.status(403).send('Unauthorized');
		return;
	}
	const idToken = req.headers.authorization.split('Bearer ')[1];
	try{
		console.log(idToken);
		const decodedIdToken = await admin.auth().verifyIdToken(idToken);
		req.user = decodedIdToken;
		next();
		return;
	}
	catch(e){
		console.log(e);
		console.log('failed verification');
		res.status(403).send('Unauthorized');
		return;
	}
};

app.use(authenticate);
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));
app.engine('html',require('ejs').renderFile);
app.get('/',(req,res) => res.render('index.html'));
app.get('/home',(req,res) => {
	console.log("hit home");
	res.render(__dirname + '/home.html');
});
app.post('/api/newuser', async (req,res) => {
	const data = req.body;
	try
	{

	var input_flag = 0;
	console.log(data);
		// create user under toodlers
	const snapshot = await admin.database().ref('/toodlers').child(`/${req.user.uid}`).set({admin: false,username: data.u,anon:data.a,toodles:0,liked:0,disliked:0});
	
	admin.database().ref('/usedNames').child("names").orderByValue().startAt(data.u.charAt(0)).endAt(data.u.charAt(0)+"\uf8ff").on("value",function(snapshot)
		{
			snapshot.forEach(function(userName)
				{
					if(userName.val().toString() === data.u.toString())
					
					{
						input_flag = 1;
						return;
					}
				});

		});
	if(!input_flag)
		{
			console.log("input flag =" + input_flag);
			const snapshot1 = await admin.database().ref('/usedNames').child("names").push(data.u);
					
		}


	res.status(200).send(true);
	}
	catch(error)
	{
		console.log(error);
		console.log('Error creating user ' + req.user.uid);
		res.sendStatus(500);
	}
}
);

app.post('/api/newtoodle', (req,res) => {
	const data = req.body;
	try
	{
	var userName = "";
	var postId = "";
	admin.database().ref("/toodlers").child(req.user.uid).once("value",function(snap)
		{
			snap.val().username = userName;
			console.log(snap.val().anon);
			if(snap.val().anon === false)
			{
				data.username = snap.val().username;
			}
		
	const snapshot = admin.database().ref('/toodles').child(`/${data.topic}`).child(`/${data.sub}`).push(
		{
			content: data.content,
			uid: req.user.uid,
			username: data.username,
			time: data.time,
			likes: 0
		});
	
	
	postId = snapshot.key;
	
	const snapshot1 = admin.database().ref('/toodlers').child(`/${req.user.uid}`).child('toodles').push({toodleID:postId});

	});
			res.sendStatus(200);
	}
	catch(err){
		console.log("Create Post Error" + err);
		res.sendStatus(500);
	}
});

app.post('/api/delete',(req,res) => {
	const data = req.body;
	try{

		// must be admin or owner of post to remove
		admin.database().ref('/toodlers').child(`/${req.user.uid}`).once("value",function(role){
			role.child('toodles').forEach(function(snap)
			{
				console.log("toodle ids: " + snap.val().toodleID);
				if(snap.val().toodleID === data.postId)
				{
					var x = snap.key;
					console.log("got here: " + JSON.stringify(x));
					admin.database().ref('toodlers').child(`/${req.user.uid}`).child('toodles').child(`/${snap.key}`).remove();

				}
			
			});	
			admin.database().ref('/toodles').child(`/${data.topic}`).child(`/${data.sub}`).once("value",function(snapshot){
				if(role.val().admin === true || snapshot.child(`/${data.postId}`).val().uid === req.user.uid)
				{

					
					admin.database().ref('toodles').child(`/${data.topic}`).child(`/${data.sub}`).child(`/${data.postId}`).remove();

					res.sendStatus(200);
				}
				else
				{
					res.sendStatus(400);
				}
				});
			
		});
	}
	catch(err)
	{
		console.log("Deletion Error" + err);
		sendStatus(500);
	}
});

app.post('/api/like',(req,res) =>{
	const data = req.body;
	var count;
	 admin.database().ref('/toodles').child(`/${data.topic}`).child(`/${data.sub}`).child(`/${data.postId}`).once("value",function(snap1){
		count = snap1.val().likes;
		console.log("like count = " + count);
	});
	if(data.dir === false)
	{
		console.log("data.dir was false");
		try {

			admin.database().ref('/toodlers').child(`/${req.user.uid}`).child('likes').child(`/${data.postId}`).once("value",function(snap){
				if(snap.val() === true || snap.val() === null)
				{
					console.log("liked status was true");
					admin.database().ref('/toodlers').child(`/${req.user.uid}`).child('likes').set({[data.postId]:false});
					count -= 1;
					admin.database().ref('/toodles').child(`/${data.topic}`).child(`/${data.sub}`).child(`/${data.postId}`).update({likes:count});

				}
			});
		res.sendStatus(200);
		}
		catch(err){
			console.log("Dislike error" + err);
			res.sendStatus(500);
		}
	}
	else if(data.dir === true)
	{
			console.log("data.dir was false");
			
			try {

				admin.database().ref('/toodlers').child(`/${req.user.uid}`).child('likes').child(`/${data.postId}`).once("value",function(snap){				
					if(snap.val() === false || snap.val() === null)
					{
						console.log("liked status was true");
						
						admin.database().ref('/toodlers').child(`/${req.user.uid}`).child('likes').set({[data.postId]:true});
						
						count += 1;
						
						admin.database().ref('/toodles').child(`/${data.topic}`).child(`/${data.sub}`).child(`/${data.postId}`).update({likes:count});
						
					}
				});
				
				res.sendStatus(200);
			}
			catch(err){
			
				console.log("Dislike error" + err);
				
				res.sendStatus(500);
			}
		}
	else
		{
			sendStatus(400);
		}
});

app.get('/api/posts', async(req,res) => {

	var data = '{"posts":[]}';
	var obj = JSON.parse(data);
	var post;
	try
	{
		 admin.database().ref('/toodles').orderByKey().on("value",function(snapshot)
			 {
				 snapshot.forEach.function(topic)
				 {
					 post.topic = topic.key;
					 snapshot.child(post.topic).forEach.function(sub)
					 {
						 post.sub = sub.key
						 snapshot.child(post.topic).child(post.sub).forEach.function(id)
						 {

							post.id = id.key;
							post.time = snapshot.child(post.topic).child(post.sub).child(post.id).child(time).val();
							post.content = snapshot.child(post.topic).child(post.sub).child(post.id).child(time).val();
							post.username = snapshot.child(post.topic).child(post.sub).child(post.id).child(username).val();
							post.uid = snapshot.child(post.topic).child(post.sub).child(post.id).child(uid).val();
							post.likes = snapshot.child(post.topic).child(post.sub).child(post.id).child(likes).val();
							obj['posts'].append(JSON.stringify(post));
						}
					 }
				 }
			 
			 });
			
			 data = JSON.stringify(obj);
			 res.status(200).send(data);
	}
	catch(err)
	{
		console.log("Error getting posts: " + err);
		res.sendStatus(500)
	}


});


//app.get('/newuser',(req,res));
// // Create and Deploy Your First Cloud Functions
// // https://firebase.google.com/docs/functions/write-firebase-functions
//
// exports.helloWorld = functions.https.onRequest((request, response) => {
//  response.send("Hello from Firebase!");
// });
