const express = require("express");
const mongoose = require("mongoose");
const nodemailer = require("nodemailer");
const otpGenerator = require("otp-generator");
const cors = require("cors");

const app = express();
const port = 3001;
const mongoURI = "mongodb://localhost:27017/anchor";

mongoose.connect(mongoURI);

const User = mongoose.model("User", {
  name: String,
  email: String,
  otp: String,
});

const Post = mongoose.model("Post", {
  title: String,
  description: String,
  userId: mongoose.Types.ObjectId,
});

const Comment = mongoose.model("Comment", {
  text: String,
  userId: mongoose.Types.ObjectId,
  postId: mongoose.Types.ObjectId,
  parentId: mongoose.Types.ObjectId,
});

app.use(cors());
app.use(express.json());

app.post("/send-otp", async (req, res) => {
  try {
    const { name, email } = req.body;

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: "User already exists" });
    }

    const otp = otpGenerator.generate(6, {
      digits: true,
      alphabets: false,
      upperCase: false,
      specialChars: false,
    });

    const newUser = new User({ name, email, otp });
    await newUser.save();

    const transporter = nodemailer.createTransport({
      host: "smtp.ethereal.email",
      service: "gmail",
      port: 587,
      secure: false,
      auth: {},
    });

    const mailOptions = {
      from: "ssb520@nist.edu",
      to: email,
      subject: "OTP Verification",
      text: `Your OTP is: ${otp}`,
    };

    await transporter.sendMail(mailOptions);

    res.status(200).json({ message: "OTP sent to your email" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

app.post("/verify-otp", async (req, res) => {
  try {
    const { email, otp } = req.body;

    const user = await User.findOne({ email, otp });
    if (!user) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    user.otp = undefined;
    await user.save();

    res
      .status(200)
      .json({ message: "OTP verified successfully", userId: user._id });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

app.get("/fetch-all-posts", async (req, res) => {
  try {
    const allPosts = await Post.find();
    res.status(200).json({ posts: allPosts });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

app.get("/fetch-post/:postId", async (req, res) => {
  try {
    const postId = req.params.postId;

    const singlePost = await Post.findById(postId);
    if (!singlePost) {
      return res.status(404).json({ message: "Post not found" });
    }

    res.status(200).json({ post: singlePost });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

app.post("/create-post", async (req, res) => {
  try {
    const { title, description, userId } = req.body;

    const newPost = new Post({ title, description, userId });
    await newPost.save();

    const user = await User.findById(userId);
    if (user) {
      await sendEmail(
        user.email,
        "Post Created",
        "Congrats! Your post is live now."
      );
    }

    res
      .status(201)
      .json({ message: "Post created successfully", postId: newPost._id });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

app.post("/create-comment", async (req, res) => {
  try {
    const { text, userId, postId, parentId } = req.body;

    const newComment = new Comment({ text, userId, postId, parentId });
    await newComment.save();

    const post = await Post.findById(postId);
    const postUser = await User.findById(post.userId);

    if (parentId) {
      const parentComment = await Comment.findById(parentId);
      const parentCommentUser = await User.findById(parentComment.userId);

      if (parentCommentUser) {
        await sendEmail(
          parentCommentUser.email,
          "Reply Notification",
          `User replied to your comment on ${post.title}.`
        );
      }

      if (postUser && postUser.email !== parentCommentUser.email) {
        await sendEmail(
          postUser.email,
          "Reply Notification",
          `Users are replying on post for ${post.title}.`
        );
      }
    } else {
      if (postUser) {
        await sendEmail(
          postUser.email,
          "Comment Notification",
          `A user commented on your post ${post.title}.`
        );
      }
    }

    res.status(201).json({
      message: "Comment created successfully",
      commentId: newComment._id,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

const sendEmail = async (to, subject, text) => {
  const transporter = nodemailer.createTransport({
    host: "smtp.ethereal.email",
    service: "gmail",
    port: 587,
    secure: false,
    auth: {},
  });

  const mailOptions = {
    from: "sachinsenapati05@gmail.com",
    to,
    subject,
    text,
  };

  await transporter.sendMail(mailOptions);
};

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
