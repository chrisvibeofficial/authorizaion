const userModel = require('../models/user');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { signUpTemplate } = require('../utils/mailTemplate');
const { sendMail } = require('../middleware/nodemailer');


exports.register = async (req, res) => {
  try {
    const { fullName, email, username, password, confirmPassword, gender } = req.body;

    if (!fullName || !email || !username || !password || !confirmPassword || !gender) {
      return res.status(400).json({
        message: 'Please complete all inputs'
      })
    };

    if (password !== confirmPassword) {
      return res.status(400).json({
        message: 'Password does not match'
      })
    }

    const existingUser = await userModel.findOne({ $or: [{ email: email.toLowerCase() }, { username: username.toLowerCase() }] });

    if (existingUser) {
      return res.status(400).json({
        message: 'Account already exist'
      })
    };

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const newUser = new userModel({
      fullName,
      email,
      username,
      password: hashedPassword,
      gender
    });

    const token = jwt.sign({ userId: newUser._id }, process.env.JWT_SECRET, { expiresIn: '5mins' });
    const link = `${req.protocol}://${req.get('host')}/api/v1/verify-account/${token}`;
    const firstName = newUser.fullName.split(' ')[0];

    const mailDetails = {
      subject: 'Email Verification',
      email: newUser.email,
      html: signUpTemplate(link, firstName)
    }

    sendMail(mailDetails);
    await newUser.save();

    res.status(201).json({
      message: 'User registered successfully',
      data: newUser
    })
  } catch (error) {
    console.log(error.message);
    res.status(500).json({
      message: 'Error Registering User'
    })
  }
};


exports.verify = async (req, res) => {
  try {
    const { token } = req.params;

    if (!token) {
      return res.status(404).json({
        message: 'Token not found'
      })
    };

    jwt.verify(token, process.env.JWT_SECRET, async (error, payload) => {
      if (error) {
        if (error instanceof jwt.JsonWebTokenError) {
          const { userId } = jwt.decode(token);
          const user = await userModel.findById(userId);

          if (!user) {
            return res.status(404).json({
              message: 'User not found'
            })
          };

          if (user.isVerified === true) {
            return res.status(400).json({
              message: 'Account has already been verified'
            })
          }

          const newToken = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '5mins' });
          const link = `${req.protocol}://${req.get('host')}/api/v1/verify-account/${token}`;
          const firstName = newUser.fullName.split(' ')[0];

          const mailDetails = {
            subject: 'Email Verification',
            email: user.email,
            html: signUpTemplate(link, firstName)
          }

          sendMail(mailDetails);
          return res.status(400).json({
            message: 'RESEND EMAIL: Session expired, Link has been sent to your email'
          })
        }
      } else {
        const user = await userModel.findById(payload.userId);
        console.log(user);
        

        if (!user) {
          return res.status(404).json({
            message: 'User not found'
          })
        };

        if (user.isVerified === true) {
          return res.status(400).json({
            message: 'Account has already been verified'
          })
        }

        user.isVerified = true;
        await user.save();

        res.status(200).json({
          message: 'Account verified successfully'
        })
      }
    })
  } catch (error) {
    console.log(error.message);
    res.status(500).json({
      message: 'Error Verifyng User'
    })
  }
}