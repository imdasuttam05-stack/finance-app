const demoUserId = "USR-DEMO";

const inMemoryData = {
  users: [],
  transactions: [],
  persons: [],
};

const isPlaceholderMongoUri = (value = "") => {
  const normalized = String(value).trim();
  return !normalized || ["undefined", "null"].includes(normalized.toLowerCase()) || normalized.includes("<username>") || normalized.includes("cluster0.xxxxy");
};

const isInMemoryMode = () => isPlaceholderMongoUri(process.env.MONGODB_URI);

const seedDemoData = () => {
  if (inMemoryData.users.length > 0 || inMemoryData.transactions.length > 0 || inMemoryData.persons.length > 0) {
    return;
  }

  const demoUser = {
    _id: "user-demo-1",
    userId: demoUserId,
    username: "demo",
    email: "demo@finance.local",
    mobile: "01700000000",
    password: "demo123",
    isRegistered: true,
    isApproved: true,
    isAdmin: false,
    role: "user",
  };

  const adminUser = {
    _id: "user-admin-1",
    userId: "USR-ADMIN",
    username: "admin",
    email: "admin@finance.com",
    mobile: "01711111111",
    password: "Admin@1234",
    isRegistered: true,
    isApproved: true,
    isAdmin: true,
    role: "admin",
  };

  inMemoryData.users.push(demoUser, adminUser);

  inMemoryData.persons.push({
    _id: "person-demo-1",
    userId: demoUserId,
    name: "Demo Ledger",
    mobile: "01700000000",
  });

  inMemoryData.transactions.push({
    _id: "txn-demo-1",
    userId: demoUserId,
    type: "income",
    subType: "",
    category: "Sales",
    subCategory: "",
    personId: "person-demo-1",
    amount: 5000,
    note: "Demo income",
    date: new Date(),
    drcr: "CR",
    balanceAfterEntry: 5000,
    againstId: null,
  });

  inMemoryData.transactions.push({
    _id: "txn-demo-2",
    userId: demoUserId,
    type: "expense",
    subType: "",
    category: "Rent",
    subCategory: "",
    personId: "person-demo-1",
    amount: 1800,
    note: "Demo expense",
    date: new Date(),
    drcr: "DR",
    balanceAfterEntry: 3200,
    againstId: null,
  });
};

const getUserByUserId = (userId) => {
  seedDemoData();
  return inMemoryData.users.find((user) => user.userId === userId) || null;
};

const authenticateUser = ({ username, password }) => {
  seedDemoData();
  const normalizedUsername = String(username || "").trim().toLowerCase();
  const normalizedPassword = String(password || "").trim();

  return inMemoryData.users.find((user) => {
    const matchesUsername = String(user.username || "").trim().toLowerCase() === normalizedUsername;
    const matchesEmail = String(user.email || "").trim().toLowerCase() === normalizedUsername;
    const matchesPassword = String(user.password || "") === normalizedPassword;
    return (matchesUsername || matchesEmail) && matchesPassword;
  }) || null;
};

const getTransactionsByUser = (userId) => {
  seedDemoData();
  return inMemoryData.transactions.filter((item) => item.userId === (userId || demoUserId));
};

const getPersonsByUser = (userId) => {
  seedDemoData();
  return inMemoryData.persons.filter((item) => item.userId === (userId || demoUserId));
};

const getSummaryByUser = (userId) => {
  const data = getTransactionsByUser(userId);
  const summary = { income: 0, expense: 0, investment: 0, asset: 0, liability: 0 };

  data.forEach((t) => {
    const amount = Number(t.amount || 0);
    if (t.type === "income") summary.income += amount;
    if (t.type === "expense") summary.expense += amount;
    if (t.type === "investment") summary.investment += amount;
    if (t.type === "loan") {
      if (t.subType === "asset") summary.asset += amount;
      if (t.subType === "liability") summary.liability += amount;
    }
  });

  return summary;
};

const getCategorySummaryByUser = (userId) => {
  const data = getTransactionsByUser(userId).filter((item) => item.type === "expense");
  const result = {};

  data.forEach((t) => {
    const key = `${t.category || "others"} - ${t.subCategory || ""}`.trim();
    result[key] = (result[key] || 0) + Number(t.amount || 0);
  });

  return result;
};

module.exports = {
  demoUserId,
  isInMemoryMode,
  seedDemoData,
  getUserByUserId,
  authenticateUser,
  getTransactionsByUser,
  getPersonsByUser,
  getSummaryByUser,
  getCategorySummaryByUser,
};
