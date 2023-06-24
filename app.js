//jshint esversion:6
require('dotenv').config();
const express = require("express");
const bodyParser = require("body-parser");
const ejs = require("ejs");
const mongoose = require("mongoose");
const session = require('express-session');
const passport = require("passport");
const passportLocalMongoose = require("passport-local-mongoose");
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const findOrCreate = require('mongoose-findorcreate');
//const bcrypt = require("bcrypt");
//const saltRounds = 10;
//const encrypt = require("mongoose-encryption");
//const md5 = require("md5");

const app = express();

//console.log(md5("12345"));
//console.log(process.env.API_KEY);

app.use(express.static("public"));
app.set('view engine','ejs');
app.use(bodyParser.urlencoded({
    extended : true
}));

app.use(session({
    secret: "Our little secret.",
    resave: false,
    saveUninitialized: false
}));

app.use(passport.initialize());
app.use(passport.session());

mongoose.connect("mongodb://localhost:27017/userDB",{useNewUrlParser: true});

const userSchema = new mongoose.Schema({
    email: String,
    password: String,
    googleId : String,
    secret: String
});

//userSchema.plugin(encrypt, { secret: process.env.SECRET,encryptedFields: ['password'] });
userSchema.plugin(passportLocalMongoose);
userSchema.plugin(findOrCreate);

const User = new mongoose.model("User", userSchema);

passport.use(User.createStrategy());

passport.serializeUser(User.serializeUser());
  
passport.deserializeUser(User.deserializeUser());

passport.use(new GoogleStrategy({
    clientID: process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,
    callbackURL: "http://localhost:3000/auth/google/secrets",
    userProfileURL: "https://www.googleapis.com/oauth2/v3/userinfo"
  },
  function(accessToken, refreshToken, profile, cb) {
    console.log(profile);
    User.findOrCreate({ googleId: profile.id }, function (err, user) {
      return cb(err, user);
    });
  }
));

app.get("/",function(req,res){
    res.render("home");
});

app.get("/auth/google",function(req,res){
    passport.authenticate("google",{scope: ["profile"]});
});

app.get('/auth/google/callback', 
  passport.authenticate('google', { failureRedirect: '/login' }),
  function(req, res) {
    // Successful authentication, redirect home.
    res.redirect('/secrets');
  });

app.get("/login",function(req,res){
    res.render("login");
});

app.get("/register",function(req,res){
    res.render("register");
});

app.get("/secrets", function(req,res){
    User.find({"secret":{$ne: null}})
    .then(foundUsers=>{
        res.render("secrets",{usersWithSecrets: foundUsers});
    })
    .catch(err=>{
        console.log(err);
    });
    /*if(req.isAuthenticated()){
        res.render("secrets");
    }else{
        res.redirect("/login");
    }*/
});

app.get("/submit",function(req,res){
    if(req.isAuthenticated()){
        res.render("submit");
    }else{
        res.redirect("/login");
    }
});

app.post("/submit",function(req,res){
    const submittedSecret = req.body.secret;
    console.log(req.user.id);
    User.findById(req.user.id)
    .then(foundUser=>{
        foundUser.secret = submittedSecret;
        foundUser.save();
        res.redirect("/secrets");
    })
    .catch(err=>{
        console.log(err);
    });
});

app.get("/logout",function(req,res){
    req.logout(function(err) {
        if (err) {
          console.log(err);
        } else {
          res.redirect('/');
        }
      });
});

app.post("/register",function(req,res){

    /*bcrypt.hash(myPlaintextPassword, saltRounds, function(err, hash) {
        const newUser = new User({
            email: req.body.username,
            password: md5(req.body.password)
        });
    
        newUser.save();
        try{
            res.render("secrets");
        }
        catch(err) {
            console.log(err);
        }
    });*/
    User.register({username: req.body.username}, req.body.password)
    .then(user=>{
        passport.authenticate("local")(req,res,function(){
            res.redirect("/secrets");
        })
    })
    .catch(err=>{
        console.log(err);
        res.redirect("/register");
    });
});

app.post("/login", function(req,res){
    /*const username = req.body.username;
    const password = md5(req.body.password);
    try{
        const foundUser = User.findOne({email: username});
        if(foundUser == req.body.password)
            res.render("secrets");
    }catch(err){
        console.log(err);
    }
    let foundUser;
    (async()=>{
        foundUser = await User.findOne({email: username});
    })
    try{
        if(foundUser){
            if(foundUser.password === password){
                res.render("secrets");
            }
        }
    }
    catch(err){
        console.log(err);
    }
    /*if(foundUser){
        bcrypt.compare(password, foundUser.password, function(err, result)){
            if(result === true)
                res.render("secrets");
        }
    }
    */
   const user = new User({
        username: req.body.username,
        password: req.body.password
   });

   req.login(user,function(err){
        if(err){
            console.log(err);
        }else{
            passport.authenticate("local")(req,res,function(){
                res.redirect("/secrets");
            });
        }
    });
});

app.listen(3000,function(){
    console.log("Server is running at port-3000");
});