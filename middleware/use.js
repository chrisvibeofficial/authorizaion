const userModel = require("../models/user");
const bcrypt = require("bcrypt");
const sendMail = require("./nodemailer")
const jwt = require("jsonwebtoken");
const { signUpTemplate, forgotPasswordTemplate } = require("../utils/mailTemplate");


exports.registerUser = async (req, res) => {
  try {
    const { fullName, email, password, gender, userName } = req.body
    const user = await userModel.findOne({ email: email.toLowerCase() })

    if (user) {
      return res.status(400).json({
        message: `User with email ${email} already exists`
      })
    };

    const randomNumber = Math.floor(Math.random() * 100);

    const userNameExists = await userModel.findOne({ userName: userName.toLowerCase() })
    if (userNameExists) {
      return res.status(400).json({
        message: `UserName already exists, try ${userName} + ${randomNumber}`
      })
    };

    const salt = await bcrypt.genSalt(10)
    const hashedPassword = await bcrypt.hash(password, salt)

    // create an instance of the document
    const newUser = new userModel({
      fullName,
      email,
      password: hashedPassword,
      gender,
      userName

    })

    const token = await jwt.sign({ userId: newUser._id }, process.env.JWT_SECRET, { expiresIn: '1h' });

    const link = `${req.protocol}://${req.get("host")}/api/v1/user-verify/${token}`
    const firstName = newUser.fullName.split(" ")[1]
    const html = signUpTemplate(link, firstName)

    const mailOptions = {
      subject: "Welcoming Email",
      email: newUser.email,
      html
    }
    await sendMail(mailOptions);

    await newUser.save()

    res.status(201).json({
      message: "User registered successfully",
      data: newUser
    })

  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Error registering User"
    })
  }
};

exports.verifyEmail = async (req, res) => {
  try {
    const { token } = req.params;
    if (!token) {
      return res.status(400).json({
        message: "Token not found"
      })
    };

    const decodedToken = await jwt.verify(token, process.env.JWT_SECRET)
    const user = await userModel.findById(decodedToken.userId);
    if (!user) {
      return res.status(404).json({
        message: "User not found"
      })
    };
    user.isVerified = true;

    await user.save()

    res.status(200).json({
      message: "User verified successfully"
    })

  } catch (error) {
    console.error(error);
    if (error instanceof jwt.JsonWebTokenError) {
      res.status(500).json({
        message: "Verification link expired"
      })
    }
    res.status(500).json({
      message: "Error verifying user User"
    })
  }
};

exports.resendVerificationEmail = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({
        message: "Please enter email address"
      })
    };
    const user = await userModel.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(400).json({
        message: "User not found"
      })
    };

    const token = await jwt.sign({ userId: user._id }, pocess.env.JWT_SECRET, { expiresIn: "1hour" });
    const link = `${req.protocol}://${req.get("host")}/api/v1/user-verify/${token}`
    const firstName = user.fullName.split(" ")[1]
    const html = signUpTemplate(link, firstName);

    const mailOptions = {
      subject: "Email verification",
      email: user.email,
      html
    };

    await sendMail(mailOptions);
    res.status(400).json({
      message: "Verification email successful, please check your email"
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Error resending verification email" + error.message
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

}
