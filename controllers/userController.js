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
};


exports.makeAdmin = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await userModel.findById(id);

    if (!user) {
      return res.status(404).json({
        message: 'User not found'
      })
    };

    if (user.isVerified === false) {
      return res.status(400).json({
        message: 'User is not verified'
      })
    };

    user.isAdmin = true;
    await user.save();

    res.status(200).json({
      message: 'User is now an admin'
    })
  } catch (error) {
    console.log(error.message);
    res.status(500).json({
      message: 'Internal Server Error'
    })
  }
};

exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    if (email == null) {
      return res.status(400).json({
        message: "Please enter your email"
      })
    };

    const user = await userModel.findOne({ email: email.toLowerCase() })
    if (!user) {
      return res.status(404).json({
        message: "user not found"
      })
    };

    const token = await jwt.sign({ userid: user._id }, process.env.JWT_SECRET, { expiresIn: "10mins" })

    const link = `${req.protocol}: //${req.get("host")}/api/v1/forgot_password/${token}`
    const firstName = user.fullName.split(" ")[0]

    const mailDetails = {
      subject: "password reset",
      email: user.email,
      html: forgotPasswordTemplate(link, firstName)
    }

    await sendMail(mailDetails)

    res.status(200).json({
      message: "Reset password initiated, please check your eamil for the reset link "
    })

  } catch (error) {
    console.error(error);
    if (error instanceof jwt.JsonWebTokenError) {
      return res.status(500).json({
        message: "Link Expired"
      })
    }
    res.status(500).json({
      message: "Internal server error"
    })
  }
};

exports.resetPassword = async (req, res) => {
  try {
    const { token } = req.params
    const { password, confirmPassword } = req.body;
    const { userId } = await jwt.verify(token, process.env.JWT_SECRET);
    const user = await userModel.findById(userId)

    if (!user) {
      return res.status(404).json({
        message: "User not found"
      })
    };

    if (password !== confirmPassword) {
      return res.status(400).json({
        message: "Password does not match"
      })
    };

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    user.password = hashedPassword

    await user.save()

    res.status(200).json({
      message: "Password reset successful"
    })


  } catch (error) {
    console.error(error);
    if (error instanceof jwt.JsonWebTokenError) {
      return res.status(500).json({
        message: "Link Expired"
      })
    }
    res.status(500).json({
      message: "Internal server error"
    })
  }
}


exports.loginUser = async (req, res) => {
  try {
    const { email, password, userName } = req.body;

    if (!email && !userName) {
      return res.status(400).json({
        message: "Please enter your email address or username"
      })
    };

    if (!password) {
      return res.status(400).json({
        message: "Please enter your password"
      })
    };
    let user;
    if (email) {
      user = await userModel.findOne({ email: email.toLowerCase() })
    }

    if (userName) {
      user = await userModel.findOne({ userName: userName.toLowerCase() })
    }

    if (!user) {
      return res.status(404).json({
        message: "User not found"
      })
    };
    const passwordCorrect = await bcrypt.compare(password, user.password);

    if (passwordCorrect === false) {
      return res.status(400).json({
        message: "Incorrect password"
      })
    };
    if (user.isVerified === false) {
      return res.status(400).json({
        message: "account notverified, please check your email for the verification link"
      })
    };
    const token = await jwt.sign({ userId: user._id, isAdmin: user.isAdmin }, process.env.JWT_SECRET, { expiresIn: "1hour" });

    res.status(200).json({
      message: "login successful",
      data: user,
      token
    })
  } catch (error) {
    console.log(error);
    res.status(500).json({
      message: "Internal server error"
    })
  }
};

exports.changePassword = async (req, res) => {
  try {
    const { password, newPassword, confirmPassword } = req.body;
    const { userId } = req.user;

    const user = await userModel.findById(userId);
    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    const passwordVerify = await bcrypt.compare(password, user.password);
    if (passwordVerify === false) {
      return res.status(404).json({
        message: "incorrect password",
      });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({
        message: "new password and confirm password does not match",
      });
    }
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    user.password = hashedPassword;

    await user.save();

    res.status(200).json({
      message: "Password changed successfully",
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({
      message: "Internal server error",
    });
  }
};