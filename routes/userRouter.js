// const { registerUser, login, verifyEmail, resendVerificationEmail, forgotPassword, loginUser } = require("../controllers/userController");
// const { authenticate, adminAuth2 } = require("../middleware/authentication");

const { register, verify, makeAdmin } = require('../controllers/userController');
const { authenticate } = require('../middleware/authentication');

// const router = require("express").Router();


// router.post("/register", registerUser)

// router.get("/user-verify/:token", verifyEmail)

// // router.post("/login", login)

// router.post("/login", loginUser)


// router.post("/forgeot_password", authenticate, adminAuth2, forgotPassword)


// router.post("/resend-verification", resendVerificationEmail)


// module.exports = router;

const router = require('express').Router();

router.post('/register', register);
router.get('/verify-account/:token', verify);
router.post('/admin/:id', authenticate, makeAdmin);

module.exports = router