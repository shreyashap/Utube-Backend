const AsyncHandler = (requestHandler) => async (req, res, next) => {
  try {
    await requestHandler(req, res, next);
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

export { AsyncHandler };
