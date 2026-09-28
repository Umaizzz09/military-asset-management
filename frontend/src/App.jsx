import { useEffect, useMemo, useState } from "react";

const API = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

function todayString() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

const TODAY = todayString();

const EMPTY_DASHBOARD = {
  openingBalance: 0,
  closingBalance: 0,
  assignedAssets: 0,
  expendedAssets: 0,
};

const EMPTY_MOVEMENT = {
  purchases: 0,
  transferIn: 0,
  transferOut: 0,
  netMovement: 0,
};

function readStoredUser() {
  try {
    return JSON.parse(localStorage.getItem("user") || "null");
  } catch {
    return null;
  }
}

function App() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loginMessage, setLoginMessage] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);

  const [loggedIn, setLoggedIn] = useState(Boolean(localStorage.getItem("token")));
  const [user, setUser] = useState(readStoredUser);
  const [page, setPage] = useState("dashboard");

  const [bases, setBases] = useState([]);
  const [equipment, setEquipment] = useState([]);
  const [assets, setAssets] = useState([]);

  const [toast, setToast] = useState(null);
  const [globalSearch, setGlobalSearch] = useState("");

  const [startDate, setStartDate] = useState(TODAY);
  const [endDate, setEndDate] = useState(TODAY);
  const [baseFilter, setBaseFilter] = useState("");
  const [equipmentFilter, setEquipmentFilter] = useState("");
  const [dashboard, setDashboard] = useState(EMPTY_DASHBOARD);
  const [movement, setMovement] = useState(EMPTY_MOVEMENT);
  const [dashboardLoading, setDashboardLoading] = useState(false);
  const [movementOpen, setMovementOpen] = useState(false);

  const [purchases, setPurchases] = useState([]);
  const [purchaseLoading, setPurchaseLoading] = useState(false);
  const [purchaseMessage, setPurchaseMessage] = useState(null);
  const [purchaseForm, setPurchaseForm] = useState({
    baseId: "",
    equipmentTypeId: "",
    quantity: "",
    purchaseDate: TODAY,
    referenceNumber: "",
    notes: "",
  });

  const [transfers, setTransfers] = useState([]);
  const [transferLoading, setTransferLoading] = useState(false);
  const [transferMessage, setTransferMessage] = useState(null);
  const [transferForm, setTransferForm] = useState({
    fromBaseId: "",
    toBaseId: "",
    equipmentTypeId: "",
    quantity: "",
    transferDate: TODAY,
    referenceNumber: "",
    notes: "",
  });

  const [assignments, setAssignments] = useState([]);
  const [assignmentLoading, setAssignmentLoading] = useState(false);
  const [assignmentMessage, setAssignmentMessage] = useState(null);
  const [assignmentForm, setAssignmentForm] = useState({
    baseId: "",
    equipmentTypeId: "",
    personnelName: "",
    quantity: "",
    assignedDate: TODAY,
    notes: "",
  });

  const [expenditures, setExpenditures] = useState([]);
  const [expenditureLoading, setExpenditureLoading] = useState(false);
  const [expenditureMessage, setExpenditureMessage] = useState(null);
  const [expenditureForm, setExpenditureForm] = useState({
    baseId: "",
    equipmentTypeId: "",
    quantity: "",
    expenditureDate: TODAY,
    reason: "",
  });

  const [auditLogs, setAuditLogs] = useState([]);
  const [auditLoading, setAuditLoading] = useState(false);

  const role = user?.role || "";
  const isAdmin = role === "Admin";
  const isCommander = role === "Base Commander";
  const isLogistics = role === "Logistics Officer";

  const navItems = useMemo(() => {
    if (isLogistics) {
      return ["purchases", "transfers"];
    }

    return [
      "dashboard",
      "inventory",
      "purchases",
      "transfers",
      "assignments",
      "expenditures",
      ...(isAdmin ? ["audit"] : []),
    ];
  }, [isAdmin, isLogistics]);

  const pageMeta = {
    dashboard: [
      "Asset Operations Dashboard",
      "Real-time inventory visibility and operational control.",
    ],
    inventory: [
      "Inventory",
      "Search and inspect current asset holdings across authorized bases.",
    ],
    purchases: [
      "Purchases",
      "Record incoming equipment and review procurement history.",
    ],
    transfers: [
      "Transfers",
      "Move equipment between bases with a complete transaction trail.",
    ],
    assignments: [
      "Assignments",
      "Allocate available equipment to authorized personnel.",
    ],
    expenditures: [
      "Expenditures",
      "Record expended equipment and review inventory reductions.",
    ],
    audit: [
      "Audit Logs",
      "Review security-sensitive actions recorded by the system.",
    ],
  };

  const assignedBase = bases.find(
    (base) => Number(base.id) === Number(user?.baseId)
  );
  const baseName = assignedBase?.name || "All authorized bases";

  useEffect(() => {
    if (!toast) return undefined;
    const timer = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    if (!loggedIn) return;
    if (!navItems.includes(page)) {
      setPage(navItems[0] || "dashboard");
    }
  }, [loggedIn, navItems, page]);

  useEffect(() => {
    if (!loggedIn) return;

    loadBases();
    loadEquipment();
    loadPurchases();
    loadTransfers();

    if (!isLogistics) {
      loadAssets();
      loadAssignments();
      loadExpenditures();
    }

    if (isAdmin) {
      loadAudit();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loggedIn]);

  useEffect(() => {
    if (!loggedIn || page !== "dashboard" || isLogistics) return;
    loadDashboard();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    loggedIn,
    page,
    startDate,
    endDate,
    baseFilter,
    equipmentFilter,
    user?.baseId,
    isCommander,
    isLogistics,
  ]);

  async function apiFetch(path, options = {}) {
    const token = localStorage.getItem("token");

    const headers = {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(options.headers || {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };

    const response = await fetch(`${API}${path}`, {
      ...options,
      headers,
    });

    let data = {};
    try {
      data = await response.json();
    } catch {
      data = {};
    }

    if (response.status === 401) {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      setLoggedIn(false);
      setUser(null);
    }

    return { response, data };
  }

  function notify(message, type = "success") {
    setToast({ message, type });
  }

  async function loadBases() {
    try {
      const { response, data } = await apiFetch("/bases");
      if (response.ok) setBases(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Base loading error:", error);
    }
  }

  async function loadEquipment() {
    try {
      const { response, data } = await apiFetch("/equipment-types");
      if (response.ok) setEquipment(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Equipment loading error:", error);
    }
  }

  async function loadAssets() {
    if (isLogistics) return;

    try {
      const { response, data } = await apiFetch("/assets");
      if (response.ok) setAssets(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Asset loading error:", error);
    }
  }

  async function loadDashboard() {
    if (isLogistics) return;

    setDashboardLoading(true);

    try {
      const effectiveBase = isCommander ? user?.baseId : baseFilter;

      let summaryUrl =
        `/dashboard/summary?startDate=${encodeURIComponent(startDate)}` +
        `&endDate=${encodeURIComponent(endDate)}`;

      let movementUrl =
        `/dashboard/movement?startDate=${encodeURIComponent(startDate)}` +
        `&endDate=${encodeURIComponent(endDate)}`;

      if (effectiveBase) {
        summaryUrl += `&baseId=${encodeURIComponent(effectiveBase)}`;
        movementUrl += `&baseId=${encodeURIComponent(effectiveBase)}`;
      }

      if (equipmentFilter) {
        summaryUrl += `&equipmentTypeId=${encodeURIComponent(equipmentFilter)}`;
        movementUrl += `&equipmentTypeId=${encodeURIComponent(equipmentFilter)}`;
      }

      const [summaryResult, movementResult] = await Promise.all([
        apiFetch(summaryUrl),
        apiFetch(movementUrl),
      ]);

      if (!summaryResult.response.ok) {
        throw new Error(
          summaryResult.data.message || "Unable to load dashboard summary."
        );
      }

      if (!movementResult.response.ok) {
        throw new Error(
          movementResult.data.message || "Unable to load movement data."
        );
      }

      setDashboard({
        openingBalance: Number(summaryResult.data.openingBalance || 0),
        closingBalance: Number(summaryResult.data.closingBalance || 0),
        assignedAssets: Number(summaryResult.data.assignedAssets || 0),
        expendedAssets: Number(summaryResult.data.expendedAssets || 0),
      });

      setMovement({
        purchases: Number(movementResult.data.purchases || 0),
        transferIn: Number(movementResult.data.transferIn || 0),
        transferOut: Number(movementResult.data.transferOut || 0),
        netMovement: Number(movementResult.data.netMovement || 0),
      });
    } catch (error) {
      console.error("Dashboard error:", error);
      notify(error.message || "Unable to load dashboard.", "error");
    } finally {
      setDashboardLoading(false);
    }
  }

  async function loadPurchases() {
    try {
      const { response, data } = await apiFetch("/purchases");
      if (response.ok) setPurchases(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Purchase loading error:", error);
    }
  }

  async function loadTransfers() {
    try {
      const { response, data } = await apiFetch("/transfers");
      if (response.ok) setTransfers(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Transfer loading error:", error);
    }
  }

  async function loadAssignments() {
    if (isLogistics) return;

    try {
      const { response, data } = await apiFetch("/assignments");
      if (response.ok) setAssignments(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Assignment loading error:", error);
    }
  }

  async function loadExpenditures() {
    if (isLogistics) return;

    try {
      const { response, data } = await apiFetch("/expenditures");
      if (response.ok) setExpenditures(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Expenditure loading error:", error);
    }
  }

  async function loadAudit() {
    if (!isAdmin) return;

    setAuditLoading(true);

    try {
      const { response, data } = await apiFetch("/audit-logs");

      if (!response.ok) {
        throw new Error(data.message || "Unable to load audit logs.");
      }

      const rows = Array.isArray(data)
        ? data
        : Array.isArray(data.logs)
        ? data.logs
        : Array.isArray(data.auditLogs)
        ? data.auditLogs
        : [];

      setAuditLogs(rows);
    } catch (error) {
      console.error("Audit loading error:", error);
      notify(error.message || "Unable to load audit logs.", "error");
    } finally {
      setAuditLoading(false);
    }
  }

  async function login(event) {
    event.preventDefault();
    setLoginMessage("");
    setLoginLoading(true);

    try {
      const { response, data } = await apiFetch("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        setLoginMessage(data.message || "Invalid email or password.");
        return;
      }

      localStorage.setItem("token", data.token);
      localStorage.setItem("user", JSON.stringify(data.user));

      setUser(data.user);
      setLoggedIn(true);
      setPage(data.user?.role === "Logistics Officer" ? "purchases" : "dashboard");
      setPassword("");
      setBaseFilter("");
      setEquipmentFilter("");
      setGlobalSearch("");

      notify("Signed in successfully.");
    } catch (error) {
      console.error("Login error:", error);
      setLoginMessage("Unable to connect to the backend.");
    } finally {
      setLoginLoading(false);
    }
  }

  function logout() {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setLoggedIn(false);
    setUser(null);
    setPage("dashboard");
    setPassword("");
    setEmail("");
    setGlobalSearch("");
    setDashboard(EMPTY_DASHBOARD);
    setMovement(EMPTY_MOVEMENT);
  }

  function updateForm(setter) {
    return (event) => {
      const { name, value } = event.target;
      setter((previous) => ({ ...previous, [name]: value }));
    };
  }

  function goTo(nextPage) {
    setPage(nextPage);
    setGlobalSearch("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function submitPurchase(event) {
    event.preventDefault();
    setPurchaseMessage(null);

    if (
      !purchaseForm.baseId ||
      !purchaseForm.equipmentTypeId ||
      !purchaseForm.quantity ||
      !purchaseForm.purchaseDate
    ) {
      setPurchaseMessage(["Please complete all required fields.", "error"]);
      return;
    }

    const purchaseQuantity = Number(purchaseForm.quantity);
    if (!Number.isInteger(purchaseQuantity) || purchaseQuantity <= 0) {
      setPurchaseMessage(["Quantity must be greater than zero.", "error"]);
      return;
    }

    setPurchaseLoading(true);

    try {
      const { response, data } = await apiFetch("/purchases", {
        method: "POST",
        body: JSON.stringify({
          baseId: Number(purchaseForm.baseId),
          equipmentTypeId: Number(purchaseForm.equipmentTypeId),
          quantity: Number(purchaseForm.quantity),
          purchaseDate: purchaseForm.purchaseDate,
          referenceNumber: purchaseForm.referenceNumber,
          notes: purchaseForm.notes,
        }),
      });

      if (!response.ok) {
        setPurchaseMessage([data.message || "Purchase failed.", "error"]);
        return;
      }

      setPurchaseMessage(["Purchase recorded successfully.", "success"]);
      setPurchaseForm({
        baseId: "",
        equipmentTypeId: "",
        quantity: "",
        purchaseDate: TODAY,
        referenceNumber: "",
        notes: "",
      });

      notify("Purchase recorded successfully.");

      await Promise.all([
        loadPurchases(),
        loadAssets(),
        loadDashboard(),
        isAdmin ? loadAudit() : Promise.resolve(),
      ]);
    } catch (error) {
      console.error("Purchase error:", error);
      setPurchaseMessage(["Unable to connect to server.", "error"]);
    } finally {
      setPurchaseLoading(false);
    }
  }

  async function submitTransfer(event) {
    event.preventDefault();
    setTransferMessage(null);

    if (
      !transferForm.fromBaseId ||
      !transferForm.toBaseId ||
      !transferForm.equipmentTypeId ||
      !transferForm.quantity ||
      !transferForm.transferDate
    ) {
      setTransferMessage(["Please complete all required fields.", "error"]);
      return;
    }

    if (transferForm.fromBaseId === transferForm.toBaseId) {
      setTransferMessage([
        "Source and destination bases must be different.",
        "error",
      ]);
      return;
    }

    const transferQuantity = Number(transferForm.quantity);
    if (!Number.isInteger(transferQuantity) || transferQuantity <= 0) {
      setTransferMessage(["Quantity must be greater than zero.", "error"]);
      return;
    }

    setTransferLoading(true);

    try {
      const { response, data } = await apiFetch("/transfers", {
        method: "POST",
        body: JSON.stringify({
          fromBaseId: Number(transferForm.fromBaseId),
          toBaseId: Number(transferForm.toBaseId),
          equipmentTypeId: Number(transferForm.equipmentTypeId),
          quantity: Number(transferForm.quantity),
          transferDate: transferForm.transferDate,
          referenceNumber: transferForm.referenceNumber,
          notes: transferForm.notes,
        }),
      });

      if (!response.ok) {
        setTransferMessage([data.message || "Transfer failed.", "error"]);
        return;
      }

      setTransferMessage(["Transfer recorded successfully.", "success"]);
      setTransferForm({
        fromBaseId: "",
        toBaseId: "",
        equipmentTypeId: "",
        quantity: "",
        transferDate: TODAY,
        referenceNumber: "",
        notes: "",
      });

      notify("Transfer recorded successfully.");

      await Promise.all([
        loadTransfers(),
        loadAssets(),
        !isLogistics ? loadDashboard() : Promise.resolve(),
        isAdmin ? loadAudit() : Promise.resolve(),
      ]);
    } catch (error) {
      console.error("Transfer error:", error);
      setTransferMessage(["Unable to connect to server.", "error"]);
    } finally {
      setTransferLoading(false);
    }
  }

  async function submitAssignment(event) {
    event.preventDefault();
    setAssignmentMessage(null);

    if (
      !assignmentForm.baseId ||
      !assignmentForm.equipmentTypeId ||
      !assignmentForm.personnelName ||
      !assignmentForm.quantity ||
      !assignmentForm.assignedDate
    ) {
      setAssignmentMessage(["Please complete all required fields.", "error"]);
      return;
    }

    const assignmentQuantity = Number(assignmentForm.quantity);
    if (!Number.isInteger(assignmentQuantity) || assignmentQuantity <= 0) {
      setAssignmentMessage(["Quantity must be greater than zero.", "error"]);
      return;
    }

    setAssignmentLoading(true);

    try {
      const assetResult = await apiFetch("/assets");

      if (!assetResult.response.ok) {
        setAssignmentMessage(["Unable to load asset inventory.", "error"]);
        return;
      }

      const assetRows = Array.isArray(assetResult.data) ? assetResult.data : [];

      const selectedBase = bases.find(
        (base) => Number(base.id) === Number(assignmentForm.baseId)
      );

      const selectedEquipment = equipment.find(
        (item) => Number(item.id) === Number(assignmentForm.equipmentTypeId)
      );

      const normalize = (value) => String(value ?? "").trim().toLowerCase();

      const selectedAsset = assetRows.find((asset) => {
        const assetBaseId =
          asset.base_id ?? asset.baseId ?? asset.baseID;
        const assetEquipmentId =
          asset.equipment_type_id ??
          asset.equipmentTypeId ??
          asset.equipmentTypeID;

        const assetBaseName =
          asset.base_name ??
          asset.base ??
          asset.baseName ??
          asset.name_of_base;

        const assetEquipmentName =
          asset.equipment_type ??
          asset.equipmentType ??
          asset.equipment_name ??
          asset.equipmentName;

        const baseMatches =
          (assetBaseId != null &&
            Number(assetBaseId) === Number(assignmentForm.baseId)) ||
          (selectedBase &&
            normalize(assetBaseName) === normalize(selectedBase.name));

        const equipmentMatches =
          (assetEquipmentId != null &&
            Number(assetEquipmentId) === Number(assignmentForm.equipmentTypeId)) ||
          (selectedEquipment &&
            normalize(assetEquipmentName) ===
              normalize(selectedEquipment.name));

        return Boolean(baseMatches && equipmentMatches);
      });

      if (!selectedAsset?.id) {
        setAssignmentMessage([
          "No asset inventory exists for that base and equipment type.",
          "error",
        ]);
        return;
      }

      const { response, data } = await apiFetch("/assignments", {
        method: "POST",
        body: JSON.stringify({
          assetId: Number(selectedAsset.id),
          personnelName: assignmentForm.personnelName,
          quantity: Number(assignmentForm.quantity),
          assignedDate: assignmentForm.assignedDate,
          notes: assignmentForm.notes,
        }),
      });

      if (!response.ok) {
        setAssignmentMessage([
          data.message || "Assignment failed.",
          "error",
        ]);
        return;
      }

      setAssignmentMessage(["Asset assigned successfully.", "success"]);
      setAssignmentForm({
        baseId: "",
        equipmentTypeId: "",
        personnelName: "",
        quantity: "",
        assignedDate: TODAY,
        notes: "",
      });

      notify("Asset assigned successfully.");

      await Promise.all([
        loadAssignments(),
        loadAssets(),
        loadDashboard(),
        isAdmin ? loadAudit() : Promise.resolve(),
      ]);
    } catch (error) {
      console.error("Assignment error:", error);
      setAssignmentMessage(["Unable to connect to server.", "error"]);
    } finally {
      setAssignmentLoading(false);
    }
  }

  async function submitExpenditure(event) {
    event.preventDefault();
    setExpenditureMessage(null);

    if (
      !expenditureForm.baseId ||
      !expenditureForm.equipmentTypeId ||
      !expenditureForm.quantity ||
      !expenditureForm.expenditureDate
    ) {
      setExpenditureMessage(["Please complete all required fields.", "error"]);
      return;
    }

    const expenditureQuantity = Number(expenditureForm.quantity);
    if (!Number.isInteger(expenditureQuantity) || expenditureQuantity <= 0) {
      setExpenditureMessage(["Quantity must be greater than zero.", "error"]);
      return;
    }

    setExpenditureLoading(true);

    try {
      const { response, data } = await apiFetch("/expenditures", {
        method: "POST",
        body: JSON.stringify({
          baseId: Number(expenditureForm.baseId),
          equipmentTypeId: Number(expenditureForm.equipmentTypeId),
          quantity: Number(expenditureForm.quantity),
          expenditureDate: expenditureForm.expenditureDate,
          reason: expenditureForm.reason,
        }),
      });

      if (!response.ok) {
        setExpenditureMessage([
          data.message || "Expenditure failed.",
          "error",
        ]);
        return;
      }

      setExpenditureMessage([
        "Expenditure recorded successfully.",
        "success",
      ]);
      setExpenditureForm({
        baseId: "",
        equipmentTypeId: "",
        quantity: "",
        expenditureDate: TODAY,
        reason: "",
      });

      notify("Expenditure recorded successfully.");

      await Promise.all([
        loadExpenditures(),
        loadAssets(),
        loadDashboard(),
        isAdmin ? loadAudit() : Promise.resolve(),
      ]);
    } catch (error) {
      console.error("Expenditure error:", error);
      setExpenditureMessage(["Unable to connect to server.", "error"]);
    } finally {
      setExpenditureLoading(false);
    }
  }

  const recentActivity = useMemo(() => {
    const items = [
      ...purchases.map((row) => ({
        type: "PURCHASE",
        title: row.equipment_type || "Equipment",
        detail: `${row.quantity} units received${
          row.base_name ? ` • ${row.base_name}` : ""
        }`,
        date: row.purchase_date,
        id: row.id,
        tone: "blue",
        user: row.created_by || "System",
      })),
      ...transfers.map((row) => ({
        type: "TRANSFER",
        title: row.equipment_type || "Equipment",
        detail: `${row.from_base || "-"} → ${row.to_base || "-"}`,
        date: row.transfer_date,
        id: row.id,
        tone: "purple",
        user: row.created_by || "System",
      })),
      ...assignments.map((row) => ({
        type: "ASSIGNMENT",
        title: row.personnel_name || "Personnel",
        detail: `${row.quantity || 0} units assigned${
          row.equipment_type ? ` • ${row.equipment_type}` : ""
        }`,
        date: row.assigned_date,
        id: row.id,
        tone: "amber",
        user: row.assigned_by || "System",
      })),
      ...expenditures.map((row) => ({
        type: "EXPENDITURE",
        title: row.equipment_type || "Equipment",
        detail: `${row.quantity || 0} units expended${
          row.reason ? ` • ${row.reason}` : ""
        }`,
        date: row.expenditure_date,
        id: row.id,
        tone: "red",
        user: row.created_by || "System",
      })),
    ];

    return items
      .sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")))
      .slice(0, 6);
  }, [purchases, transfers, assignments, expenditures]);

  if (!loggedIn) {
    return (
      <>
        <style>{STYLES}</style>
        <LoginPage
          email={email}
          password={password}
          setEmail={setEmail}
          setPassword={setPassword}
          loading={loginLoading}
          message={loginMessage}
          onSubmit={login}
        />
      </>
    );
  }

  const currentMeta = pageMeta[page] || pageMeta.dashboard;

  return (
    <>
      <style>{STYLES}</style>

      <div className="app-shell">
        <aside className="sidebar">
          <div className="brand-block">
            <div className="brand-mark">
              <Icon name="shield" size={23} />
            </div>
            <div>
              <div className="brand-name">MILITARY ASSET</div>
              <div className="brand-subtitle">CONTROL SYSTEM</div>
            </div>
          </div>

          <div className="sidebar-search">
            <Icon name="search" size={16} />
            <input
              value={globalSearch}
              onChange={(event) => setGlobalSearch(event.target.value)}
              placeholder="Search..."
              aria-label="Search current records"
            />
            <span>⌘K</span>
          </div>

          <div className="nav-heading">OPERATIONS</div>

          <nav className="nav-stack">
            {navItems.map((item) => (
              <button
                key={item}
                className={`nav-button ${page === item ? "active" : ""}`}
                onClick={() => goTo(item)}
              >
                <span className="nav-icon">
                  <Icon name={item} size={17} />
                </span>
                <span>{labelFor(item)}</span>
              </button>
            ))}
          </nav>

          <div className="sidebar-bottom">
            <div className="sidebar-status">
              <span className="online-dot" />
              <div>
                <strong>System online</strong>
                <span>Secure session</span>
              </div>
            </div>

            <button className="signout-button" onClick={logout}>
              <Icon name="logout" size={17} />
              <span>Sign out</span>
            </button>
          </div>
        </aside>

        <main className="main-area">
          <header className="topbar">
            <div className="topbar-copy">
              <div className="breadcrumb">
                Operations <span>/</span> {currentMeta[0]}
              </div>
              <h1>{currentMeta[0]}</h1>
              <p>{currentMeta[1]}</p>
            </div>

            <div className="topbar-actions">
              <button className="icon-top-button" aria-label="Notifications">
                <Icon name="bell" size={17} />
                {auditLogs.length > 0 && isAdmin && <span className="notification-dot" />}
              </button>

              <div className="user-card">
                <div className="avatar">
                  {(user?.name || "U").charAt(0).toUpperCase()}
                </div>
                <div className="user-text">
                  <strong>{user?.name || "System User"}</strong>
                  <span>
                    {role}
                    {isCommander ? ` • ${baseName}` : ""}
                  </span>
                </div>
                <Icon name="chevron" size={14} />
              </div>
            </div>
          </header>

          <div className="page-content">
            {page === "dashboard" && !isLogistics && (
              <DashboardPage
                startDate={startDate}
                endDate={endDate}
                setStartDate={setStartDate}
                setEndDate={setEndDate}
                baseFilter={baseFilter}
                setBaseFilter={setBaseFilter}
                equipmentFilter={equipmentFilter}
                setEquipmentFilter={setEquipmentFilter}
                bases={bases}
                equipment={equipment}
                dashboard={dashboard}
                movement={movement}
                loading={dashboardLoading}
                commander={isCommander}
                baseName={baseName}
                assets={assets}
                activities={recentActivity}
                onMovement={() => setMovementOpen(true)}
              />
            )}

            {page === "inventory" && !isLogistics && (
              <InventoryPage
                rows={assets}
                bases={bases}
                equipment={equipment}
                search={globalSearch}
              />
            )}

            {page === "purchases" && (
              <PurchasesPage
                form={purchaseForm}
                setForm={setPurchaseForm}
                bases={bases}
                equipment={equipment}
                rows={purchases}
                message={purchaseMessage}
                loading={purchaseLoading}
                submit={submitPurchase}
                canCreate={isAdmin || isLogistics}
                search={globalSearch}
              />
            )}

            {page === "transfers" && (
              <TransfersPage
                form={transferForm}
                setForm={setTransferForm}
                bases={bases}
                equipment={equipment}
                rows={transfers}
                message={transferMessage}
                loading={transferLoading}
                submit={submitTransfer}
                canCreate={isAdmin || isLogistics}
                search={globalSearch}
              />
            )}

            {page === "assignments" && !isLogistics && (
              <AssignmentsPage
                form={assignmentForm}
                setForm={setAssignmentForm}
                bases={bases}
                equipment={equipment}
                rows={assignments}
                message={assignmentMessage}
                loading={assignmentLoading}
                submit={submitAssignment}
                search={globalSearch}
              />
            )}

            {page === "expenditures" && !isLogistics && (
              <ExpendituresPage
                form={expenditureForm}
                setForm={setExpenditureForm}
                bases={bases}
                equipment={equipment}
                rows={expenditures}
                message={expenditureMessage}
                loading={expenditureLoading}
                submit={submitExpenditure}
                search={globalSearch}
              />
            )}

            {page === "audit" && isAdmin && (
              <AuditPage
                rows={auditLogs}
                loading={auditLoading}
                search={globalSearch}
              />
            )}
          </div>
        </main>

        {toast && (
          <div className={`toast ${toast.type}`}>
            <Icon
              name={toast.type === "error" ? "alert" : "check"}
              size={17}
            />
            <span>{toast.message}</span>
          </div>
        )}

        {movementOpen && (
          <MovementModal
            movement={movement}
            close={() => setMovementOpen(false)}
          />
        )}
      </div>
    </>
  );
}

function LoginPage({
  email,
  password,
  setEmail,
  setPassword,
  loading,
  message,
  onSubmit,
}) {
  return (
    <div className="login-page">
      <div className="login-shell">
        <section className="login-intro">
          <div className="login-brand-row">
            <div className="login-brand-mark">
              <Icon name="shield" size={28} />
            </div>
            <div>
              <strong>MILITARY ASSET</strong>
              <span>CONTROL SYSTEM</span>
            </div>
          </div>

          <div className="login-intro-content">
            <span className="section-kicker">OPERATIONS COMMAND</span>
            <h1>Asset control built for accountable operations.</h1>
            <p>
              Manage inventory, base movement, assignments and expenditures
              through one secure operational platform.
            </p>

            <div className="login-feature-list">
              <FeatureItem
                icon="shield"
                title="Role-based permissions"
                text="Access is enforced by user role and assigned base."
              />
              <FeatureItem
                icon="activity"
                title="Live inventory visibility"
                text="Track balances and movement from a single dashboard."
              />
              <FeatureItem
                icon="audit"
                title="Auditable operational trail"
                text="Important actions are recorded for accountability."
              />
            </div>
          </div>

          <div className="login-intro-footer">
            <span className="online-dot" />
            SECURE OPERATIONS
            <i>•</i>
            AUTHORIZED PERSONNEL ONLY
          </div>
        </section>

        <section className="login-form-side">
          <div className="mobile-brand">
            <div className="login-brand-mark">
              <Icon name="shield" size={24} />
            </div>
            <div>
              <strong>MILITARY ASSET</strong>
              <span>CONTROL SYSTEM</span>
            </div>
          </div>

          <div className="login-heading">
            <span className="section-kicker">SECURE ACCESS</span>
            <h2>Welcome back</h2>
            <p>Sign in to access the command portal.</p>
          </div>

          <form className="login-form" onSubmit={onSubmit}>
            <Field
              label="Email address"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="name@militaryasset.com"
              required
            />

            <Field
              label="Password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Enter your password"
              required
            />

            {message && (
              <div className="message error">
                <Icon name="alert" size={16} />
                <span>{message}</span>
              </div>
            )}

            <button className="primary-button login-submit" disabled={loading}>
              {loading ? <Spinner /> : <Icon name="login" size={17} />}
              <span>{loading ? "Authenticating..." : "Sign in to portal"}</span>
            </button>
          </form>

          <div className="login-security">
            <Icon name="lock" size={14} />
            <span>Authenticated access</span>
            <i>•</i>
            <span>Role-based permissions enabled</span>
          </div>
        </section>
      </div>
    </div>
  );
}

function FeatureItem({ icon, title, text }) {
  return (
    <div className="feature-item">
      <div className="feature-icon">
        <Icon name={icon} size={17} />
      </div>
      <div>
        <strong>{title}</strong>
        <span>{text}</span>
      </div>
    </div>
  );
}

function DashboardPage({
  startDate,
  endDate,
  setStartDate,
  setEndDate,
  baseFilter,
  setBaseFilter,
  equipmentFilter,
  setEquipmentFilter,
  bases,
  equipment,
  dashboard,
  movement,
  loading,
  commander,
  baseName,
  assets,
  activities,
  onMovement,
}) {
  const maxMovement = Math.max(
    movement.purchases,
    movement.transferIn,
    movement.transferOut,
    1
  );

  const totalTracked =
    dashboard.closingBalance +
    dashboard.assignedAssets +
    dashboard.expendedAssets;

  const positionPercent =
    totalTracked > 0
      ? Math.min(
          100,
          Math.max(0, (dashboard.closingBalance / totalTracked) * 100)
        )
      : 0;

  const baseTotals = useMemo(() => {
    const map = new Map();

    assets.forEach((asset) => {
      const name = asset.base_name || asset.base || asset.baseName || "Unknown";
      const quantity = Number(asset.quantity || 0);
      map.set(name, (map.get(name) || 0) + quantity);
    });

    return Array.from(map.entries())
      .map(([name, quantity]) => ({ name, quantity }))
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 5);
  }, [assets]);

  return (
    <section>
      <div className="hero-row">
        <div>
          <span className="section-kicker">OPERATIONS COMMAND</span>
          <h2>Inventory at a glance.</h2>
          <p>
            {commander
              ? `Focused view for ${baseName}.`
              : "A connected view of inventory position, movement and operational activity."}
          </p>
        </div>
        <div className="hero-date">
          <Icon name="calendar" size={16} />
          <div>
            <span>Reporting period</span>
            <strong>
              {formatDate(startDate)} — {formatDate(endDate)}
            </strong>
          </div>
        </div>
      </div>

      <div className="filter-panel">
        <div className="filter-heading">
          <div>
            <span className="eyebrow">FILTERS</span>
            <h3>Control the reporting view</h3>
          </div>
          <button className="ghost-button" onClick={onMovement}>
            <Icon name="activity" size={15} />
            Movement details
          </button>
        </div>

        <div className="filter-grid">
          <Field
            label="Start date"
            type="date"
            value={startDate}
            onChange={(event) => setStartDate(event.target.value)}
          />
          <Field
            label="End date"
            type="date"
            value={endDate}
            onChange={(event) => setEndDate(event.target.value)}
          />
          <SelectField
            label="Base"
            value={baseFilter}
            onChange={(event) => setBaseFilter(event.target.value)}
            disabled={commander}
          >
            <option value="">All bases</option>
            {bases.map((base) => (
              <option key={base.id} value={base.id}>
                {base.name}
              </option>
            ))}
          </SelectField>
          <SelectField
            label="Equipment type"
            value={equipmentFilter}
            onChange={(event) => setEquipmentFilter(event.target.value)}
          >
            <option value="">All equipment</option>
            {equipment.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </SelectField>
        </div>
      </div>

      <div className="kpi-grid">
        <KpiCard label="Opening balance" value={dashboard.openingBalance} icon="archive" tone="blue" loading={loading} />
        <KpiCard label="Closing balance" value={dashboard.closingBalance} icon="box" tone="green" loading={loading} />
        <KpiCard label="Net movement" value={movement.netMovement} icon="activity" tone="purple" loading={loading} onClick={onMovement} action="View details" />
        <KpiCard label="Assigned assets" value={dashboard.assignedAssets} icon="assignment" tone="amber" loading={loading} />
        <KpiCard label="Expended assets" value={dashboard.expendedAssets} icon="expenditure" tone="red" loading={loading} />
      </div>

      <div className="dashboard-main-grid">
        <div className="panel chart-card">
          <PanelHeading
            kicker="MOVEMENT ANALYSIS"
            title="Inventory movement"
            text="Recorded activity during the selected reporting period."
          />

          <div className="movement-chart">
            <MovementBar label="Purchases" value={movement.purchases} max={maxMovement} icon="purchase" />
            <MovementBar label="Transfer in" value={movement.transferIn} max={maxMovement} icon="arrowDown" />
            <MovementBar label="Transfer out" value={movement.transferOut} max={maxMovement} icon="arrowUp" />
          </div>
        </div>

        <div className="panel position-card">
          <PanelHeading
            kicker="CURRENT POSITION"
            title="Inventory position"
            text="Closing balance within the current operational view."
          />

          <div className="position-content">
            <div
              className="position-ring"
              style={{
                "--ring": `${positionPercent}%`,
              }}
            >
              <div>
                <strong>{dashboard.closingBalance}</strong>
                <span>closing units</span>
              </div>
            </div>

            <div className="position-metrics">
              <MetricRow label="Opening" value={dashboard.openingBalance} />
              <MetricRow label="Net movement" value={movement.netMovement} positive />
              <MetricRow label="Assigned" value={dashboard.assignedAssets} />
              <MetricRow label="Expended" value={dashboard.expendedAssets} />
            </div>
          </div>
        </div>
      </div>

      <div className="lower-dashboard-grid">
        <div className="panel activity-card">
          <PanelHeading
            kicker="RECENT ACTIVITY"
            title="Operational activity"
            text="Latest recorded movements and allocations."
          />

          {activities.length === 0 ? (
            <EmptyState compact text="No recent activity." />
          ) : (
            <div className="activity-list">
              {activities.map((item, index) => (
                <div className="activity-row" key={`${item.type}-${item.id}-${index}`}>
                  <div className={`activity-dot ${item.tone}`} />
                  <div className="activity-main">
                    <div>
                      <StatusBadge text={item.type} tone={item.tone} />
                      <strong>{item.title}</strong>
                    </div>
                    <span>{item.detail}</span>
                  </div>
                  <div className="activity-meta">
                    <strong>{item.user}</strong>
                    <span>{formatDate(item.date)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="panel base-card">
          <PanelHeading
            kicker="BASE DISTRIBUTION"
            title="Inventory by base"
            text="Top authorized base holdings."
          />

          {baseTotals.length === 0 ? (
            <EmptyState compact text="No inventory records." />
          ) : (
            <div className="base-list">
              {baseTotals.map((base, index) => {
                const max = Math.max(...baseTotals.map((item) => item.quantity), 1);
                const width = Math.max(8, Math.round((base.quantity / max) * 100));
                return (
                  <div className="base-row" key={base.name}>
                    <div>
                      <span className="base-rank">{String(index + 1).padStart(2, "0")}</span>
                      <strong>{base.name}</strong>
                    </div>
                    <div className="base-track">
                      <div className="base-fill" style={{ width: `${width}%` }} />
                    </div>
                    <span className="base-quantity">{base.quantity}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div className="insight-strip">
        <div className="insight-icon">
          <Icon name="spark" size={18} />
        </div>
        <div>
          <span className="eyebrow">CONNECTED OPERATIONS</span>
          <strong>One system for inventory, movement and accountability.</strong>
        </div>
        <div className="insight-points">
          <span><Icon name="check" size={13} /> Role-aware access</span>
          <span><Icon name="check" size={13} /> Transaction history</span>
          <span><Icon name="check" size={13} /> Audit-ready records</span>
        </div>
      </div>
    </section>
  );
}

function InventoryPage({ rows, search, bases, equipment }) {
  const [baseFilter, setBaseFilter] = useState("");
  const [equipmentFilter, setEquipmentFilter] = useState("");

  const filtered = rows.filter((row) => {
    const baseId = row.base_id ?? row.baseId;
    const equipmentId = row.equipment_type_id ?? row.equipmentTypeId;

    const baseOk = !baseFilter || String(baseId) === String(baseFilter);
    const equipmentOk =
      !equipmentFilter || String(equipmentId) === String(equipmentFilter);

    const haystack = [
      row.id,
      row.asset_code,
      row.base_name,
      row.base,
      row.equipment_type,
      row.equipment_name,
      row.status,
      row.quantity,
    ]
      .join(" ")
      .toLowerCase();

    return (
      baseOk &&
      equipmentOk &&
      (!search || haystack.includes(search.toLowerCase()))
    );
  });

  const total = filtered.reduce((sum, row) => sum + Number(row.quantity || 0), 0);

  return (
    <section>
      <div className="section-intro-row">
        <div>
          <span className="section-kicker">ASSET REGISTER</span>
          <h2>Current inventory</h2>
          <p>Inspect live asset holdings returned by the authorized inventory API.</p>
        </div>
        <div className="mini-summary">
          <span>Visible units</span>
          <strong>{total}</strong>
        </div>
      </div>

      <div className="mini-filter-panel">
        <SelectField
          label="Base"
          value={baseFilter}
          onChange={(event) => setBaseFilter(event.target.value)}
        >
          <option value="">All bases</option>
          {bases.map((base) => (
            <option key={base.id} value={base.id}>
              {base.name}
            </option>
          ))}
        </SelectField>

        <SelectField
          label="Equipment type"
          value={equipmentFilter}
          onChange={(event) => setEquipmentFilter(event.target.value)}
        >
          <option value="">All equipment</option>
          {equipment.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </SelectField>

        <div className="search-hint">
          <Icon name="search" size={15} />
          <span>{search ? `Searching “${search}”` : "Use the sidebar search to find a record."}</span>
        </div>
      </div>

      <TablePanel kicker="INVENTORY" title="Asset register" count={filtered.length}>
        {filtered.length === 0 ? (
          <EmptyState text="No matching inventory records." />
        ) : (
          <DataTable
            columns={[
              "ID",
              "Asset code",
              "Base",
              "Equipment",
              "Quantity",
              "Status",
            ]}
            rows={filtered.map((row) => [
              row.id,
              row.asset_code || row.assetCode || "-",
              row.base_name || row.base || row.baseName || "-",
              row.equipment_type || row.equipment_name || "-",
              <QuantityBadge key={`q-${row.id}`} value={row.quantity} />,
              <StatusBadge
                key={`s-${row.id}`}
                text={row.status || "ACTIVE"}
                tone="green"
              />,
            ])}
          />
        )}
      </TablePanel>
    </section>
  );
}

function PurchasesPage({
  form,
  setForm,
  bases,
  equipment,
  rows,
  message,
  loading,
  submit,
  canCreate,
  search,
}) {
  const filtered = rows.filter((row) =>
    searchMatch(
      [
        row.id,
        row.purchase_date,
        row.base_name,
        row.equipment_type,
        row.quantity,
        row.reference_number,
        row.created_by,
      ],
      search
    )
  );

  return (
    <section>
      {canCreate ? (
        <FormPanel
          kicker="PROCUREMENT"
          title="Record a purchase"
          text="Add newly procured equipment to the selected base inventory."
          icon="purchase"
          onSubmit={submit}
          loading={loading}
          buttonLabel="Record purchase"
          message={message}
        >
          <SelectField
            label="Base"
            name="baseId"
            value={form.baseId}
            onChange={update(setForm)}
            required
          >
            <option value="">Select base</option>
            {bases.map((base) => (
              <option key={base.id} value={base.id}>
                {base.name}
              </option>
            ))}
          </SelectField>

          <SelectField
            label="Equipment type"
            name="equipmentTypeId"
            value={form.equipmentTypeId}
            onChange={update(setForm)}
            required
          >
            <option value="">Select equipment</option>
            {equipment.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </SelectField>

          <Field
            label="Quantity"
            name="quantity"
            type="number"
            min="1"
          step="1"
            value={form.quantity}
            onChange={update(setForm)}
            placeholder="Enter quantity"
            required
          />

          <Field
            label="Purchase date"
            name="purchaseDate"
            type="date"
            value={form.purchaseDate}
            onChange={update(setForm)}
            required
          />

          <Field
            label="Reference number"
            name="referenceNumber"
            value={form.referenceNumber}
            onChange={update(setForm)}
            placeholder="e.g. PO-002"
          />

          <Field
            label="Notes"
            name="notes"
            value={form.notes}
            onChange={update(setForm)}
            placeholder="Optional notes"
          />
        </FormPanel>
      ) : (
        <PermissionNotice
          title="Read-only purchase history"
          text="Your role can review purchase records, but creating purchases is restricted by the system."
        />
      )}

      <TablePanel kicker="RECORDS" title="Purchase history" count={filtered.length}>
        {filtered.length === 0 ? (
          <EmptyState text="No purchase records found." />
        ) : (
          <DataTable
            columns={[
              "ID",
              "Date",
              "Base",
              "Equipment",
              "Quantity",
              "Reference",
              "Created by",
            ]}
            rows={filtered.map((row) => [
              row.id,
              formatDate(row.purchase_date),
              row.base_name || "-",
              row.equipment_type || "-",
              <QuantityBadge key={`q-${row.id}`} value={row.quantity} tone="blue" />,
              row.reference_number || "-",
              row.created_by || "-",
            ])}
          />
        )}
      </TablePanel>
    </section>
  );
}

function TransfersPage({
  form,
  setForm,
  bases,
  equipment,
  rows,
  message,
  loading,
  submit,
  canCreate,
  search,
}) {
  const filtered = rows.filter((row) =>
    searchMatch(
      [
        row.id,
        row.transfer_date,
        row.from_base,
        row.to_base,
        row.equipment_type,
        row.quantity,
        row.reference_number,
        row.created_by,
      ],
      search
    )
  );

  return (
    <section>
      {canCreate ? (
        <FormPanel
          kicker="INVENTORY MOVEMENT"
          title="Record a transfer"
          text="Move equipment between bases using the protected transfer workflow."
          icon="transfer"
          onSubmit={submit}
          loading={loading}
          buttonLabel="Record transfer"
          message={message}
        >
          <SelectField
            label="From base"
            name="fromBaseId"
            value={form.fromBaseId}
            onChange={update(setForm)}
            required
          >
            <option value="">Select source base</option>
            {bases.map((base) => (
              <option key={base.id} value={base.id}>
                {base.name}
              </option>
            ))}
          </SelectField>

          <SelectField
            label="To base"
            name="toBaseId"
            value={form.toBaseId}
            onChange={update(setForm)}
            required
          >
            <option value="">Select destination base</option>
            {bases.map((base) => (
              <option key={base.id} value={base.id}>
                {base.name}
              </option>
            ))}
          </SelectField>

          <SelectField
            label="Equipment type"
            name="equipmentTypeId"
            value={form.equipmentTypeId}
            onChange={update(setForm)}
            required
          >
            <option value="">Select equipment</option>
            {equipment.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </SelectField>

          <Field
            label="Quantity"
            name="quantity"
            type="number"
            min="1"
          step="1"
            value={form.quantity}
            onChange={update(setForm)}
            placeholder="Enter quantity"
            required
          />

          <Field
            label="Transfer date"
            name="transferDate"
            type="date"
            value={form.transferDate}
            onChange={update(setForm)}
            required
          />

          <Field
            label="Reference number"
            name="referenceNumber"
            value={form.referenceNumber}
            onChange={update(setForm)}
            placeholder="e.g. TR-002"
          />

          <Field
            label="Notes"
            name="notes"
            value={form.notes}
            onChange={update(setForm)}
            placeholder="Optional notes"
            wide
          />
        </FormPanel>
      ) : (
        <PermissionNotice
          title="Read-only transfer history"
          text="Your role can review transfer records, but initiating transfers is restricted by the system."
        />
      )}

      <TablePanel kicker="RECORDS" title="Transfer history" count={filtered.length}>
        {filtered.length === 0 ? (
          <EmptyState text="No transfer records found." />
        ) : (
          <DataTable
            columns={[
              "ID",
              "Date",
              "Route",
              "Equipment",
              "Quantity",
              "Reference",
              "Created by",
            ]}
            rows={filtered.map((row) => [
              row.id,
              formatDate(row.transfer_date),
              <div className="route-cell" key={`route-${row.id}`}>
                <span>{row.from_base || "-"}</span>
                <Icon name="arrowRight" size={13} />
                <span>{row.to_base || "-"}</span>
              </div>,
              row.equipment_type || "-",
              <QuantityBadge key={`q-${row.id}`} value={row.quantity} tone="purple" />,
              row.reference_number || "-",
              row.created_by || "-",
            ])}
          />
        )}
      </TablePanel>
    </section>
  );
}

function AssignmentsPage({
  form,
  setForm,
  bases,
  equipment,
  rows,
  message,
  loading,
  submit,
  search,
}) {
  const filtered = rows.filter((row) =>
    searchMatch(
      [
        row.id,
        row.assigned_date,
        row.base_name,
        row.base,
        row.equipment_type,
        row.personnel_name,
        row.quantity,
        row.notes,
        row.assigned_by,
      ],
      search
    )
  );

  return (
    <section>
      <FormPanel
        kicker="PERSONNEL ALLOCATION"
        title="Assign an asset"
        text="Allocate available equipment to authorized personnel at a base."
        icon="assignment"
        onSubmit={submit}
        loading={loading}
        buttonLabel="Assign asset"
        message={message}
      >
        <SelectField
          label="Base"
          name="baseId"
          value={form.baseId}
          onChange={update(setForm)}
          required
        >
          <option value="">Select base</option>
          {bases.map((base) => (
            <option key={base.id} value={base.id}>
              {base.name}
            </option>
          ))}
        </SelectField>

        <SelectField
          label="Equipment type"
          name="equipmentTypeId"
          value={form.equipmentTypeId}
          onChange={update(setForm)}
          required
        >
          <option value="">Select equipment</option>
          {equipment.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </SelectField>

        <Field
          label="Personnel name"
          name="personnelName"
          value={form.personnelName}
          onChange={update(setForm)}
          placeholder="Enter personnel name"
          required
        />

        <Field
          label="Quantity"
          name="quantity"
          type="number"
          min="1"
          step="1"
          value={form.quantity}
          onChange={update(setForm)}
          placeholder="Enter quantity"
          required
        />

        <Field
          label="Assignment date"
          name="assignedDate"
          type="date"
          value={form.assignedDate}
          onChange={update(setForm)}
          required
        />

        <Field
          label="Notes"
          name="notes"
          value={form.notes}
          onChange={update(setForm)}
          placeholder="Optional notes"
        />
      </FormPanel>

      <TablePanel kicker="RECORDS" title="Assignment history" count={filtered.length}>
        {filtered.length === 0 ? (
          <EmptyState text="No assignment records found." />
        ) : (
          <DataTable
            columns={[
              "ID",
              "Date",
              "Base",
              "Equipment",
              "Personnel",
              "Quantity",
              "Notes",
              "Assigned by",
            ]}
            rows={filtered.map((row) => [
              row.id,
              formatDate(row.assigned_date),
              row.base_name || row.base || "-",
              row.equipment_type || "-",
              row.personnel_name || "-",
              <QuantityBadge key={`q-${row.id}`} value={row.quantity} tone="amber" />,
              row.notes || "-",
              row.assigned_by || "-",
            ])}
          />
        )}
      </TablePanel>
    </section>
  );
}

function ExpendituresPage({
  form,
  setForm,
  bases,
  equipment,
  rows,
  message,
  loading,
  submit,
  search,
}) {
  const filtered = rows.filter((row) =>
    searchMatch(
      [
        row.id,
        row.expenditure_date,
        row.base_name,
        row.base,
        row.equipment_type,
        row.quantity,
        row.reason,
        row.created_by,
      ],
      search
    )
  );

  return (
    <section>
      <FormPanel
        kicker="OUTBOUND INVENTORY"
        title="Record an expenditure"
        text="Record equipment consumed or expended from a selected base inventory."
        icon="expenditure"
        onSubmit={submit}
        loading={loading}
        buttonLabel="Record expenditure"
        message={message}
      >
        <SelectField
          label="Base"
          name="baseId"
          value={form.baseId}
          onChange={update(setForm)}
          required
        >
          <option value="">Select base</option>
          {bases.map((base) => (
            <option key={base.id} value={base.id}>
              {base.name}
            </option>
          ))}
        </SelectField>

        <SelectField
          label="Equipment type"
          name="equipmentTypeId"
          value={form.equipmentTypeId}
          onChange={update(setForm)}
          required
        >
          <option value="">Select equipment</option>
          {equipment.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </SelectField>

        <Field
          label="Quantity"
          name="quantity"
          type="number"
          min="1"
          step="1"
          value={form.quantity}
          onChange={update(setForm)}
          placeholder="Enter quantity"
          required
        />

        <Field
          label="Expenditure date"
          name="expenditureDate"
          type="date"
          value={form.expenditureDate}
          onChange={update(setForm)}
          required
        />

        <Field
          label="Reason"
          name="reason"
          value={form.reason}
          onChange={update(setForm)}
          placeholder="Enter reason"
          wide
        />
      </FormPanel>

      <TablePanel kicker="RECORDS" title="Expenditure history" count={filtered.length}>
        {filtered.length === 0 ? (
          <EmptyState text="No expenditure records found." />
        ) : (
          <DataTable
            columns={[
              "ID",
              "Date",
              "Base",
              "Equipment",
              "Quantity",
              "Reason",
              "Created by",
            ]}
            rows={filtered.map((row) => [
              row.id,
              formatDate(row.expenditure_date),
              row.base_name || row.base || "-",
              row.equipment_type || "-",
              <QuantityBadge key={`q-${row.id}`} value={row.quantity} tone="red" />,
              row.reason || "-",
              row.created_by || "-",
            ])}
          />
        )}
      </TablePanel>
    </section>
  );
}

function AuditPage({ rows, loading, search }) {
  const filtered = rows.filter((row) =>
    searchMatch(
      [
        row.id,
        row.action,
        row.entity_type,
        row.entityType,
        row.user_name,
        row.user,
        row.email,
        row.created_at,
        row.details,
      ],
      search
    )
  );

  return (
    <section>
      <div className="audit-hero">
        <div className="audit-icon">
          <Icon name="audit" size={23} />
        </div>
        <div>
          <span className="section-kicker">SECURITY & ACCOUNTABILITY</span>
          <h2>Audit-ready operations.</h2>
          <p>
            Every important inventory mutation can be reviewed with its acting
            user, entity and recorded details.
          </p>
        </div>
        <div className="audit-count">
          <strong>{rows.length}</strong>
          <span>recorded events</span>
        </div>
      </div>

      <TablePanel kicker="AUDIT TRAIL" title="System activity" count={filtered.length}>
        {loading ? (
          <LoadingState text="Loading audit records..." />
        ) : filtered.length === 0 ? (
          <EmptyState text="No audit records found." />
        ) : (
          <DataTable
            columns={[
              "ID",
              "Time",
              "User",
              "Action",
              "Entity",
              "Details",
            ]}
            rows={filtered.map((row) => [
              row.id,
              formatDateTime(row.created_at || row.createdAt || row.timestamp),
              row.user_name ||
                row.user ||
                row.email ||
                row.user_email ||
                "-",
              <StatusBadge
                key={`a-${row.id}`}
                text={String(row.action || "ACTION").replaceAll("_", " ")}
                tone="blue"
              />,
              row.entity_type || row.entityType || "-",
              formatDetails(row.details),
            ])}
          />
        )}
      </TablePanel>
    </section>
  );
}

function FormPanel({
  kicker,
  title,
  text,
  icon,
  onSubmit,
  loading,
  buttonLabel,
  message,
  children,
}) {
  return (
    <div className="panel form-panel">
      <div className="panel-heading-row">
        <div>
          <span className="eyebrow">{kicker}</span>
          <h2>{title}</h2>
          <p>{text}</p>
        </div>
        <div className="panel-action-icon">
          <Icon name={icon} size={19} />
        </div>
      </div>

      <form onSubmit={onSubmit}>
        <div className="form-grid">{children}</div>

        <div className="form-footer">
          <div className="form-security">
            <Icon name="lock" size={14} />
            <span>Action protected by role-based access control</span>
          </div>

          <button className="primary-button form-submit" disabled={loading}>
            {loading ? <Spinner /> : <Icon name="check" size={16} />}
            <span>{loading ? "Saving..." : buttonLabel}</span>
          </button>
        </div>

        <MessageBox value={message} />
      </form>
    </div>
  );
}

function PermissionNotice({ title, text }) {
  return (
    <div className="permission-notice">
      <div className="permission-icon">
        <Icon name="lock" size={18} />
      </div>
      <div>
        <span className="eyebrow">ROLE RESTRICTION</span>
        <strong>{title}</strong>
        <p>{text}</p>
      </div>
    </div>
  );
}

function TablePanel({
  kicker,
  title,
  count,
  children,
}) {
  return (
    <div className="panel table-panel">
      <div className="table-panel-heading">
        <div>
          <span className="eyebrow">{kicker}</span>
          <h2>{title}</h2>
        </div>
        <span className="record-pill">
          {count} {count === 1 ? "record" : "records"}
        </span>
      </div>
      {children}
    </div>
  );
}

function DataTable({ columns, rows }) {
  return (
    <div className="table-scroll">
      <table className="data-table">
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column}>{column}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={index}>
              {row.map((cell, cellIndex) => (
                <td key={cellIndex}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PanelHeading({ kicker, title, text }) {
  return (
    <div className="panel-heading">
      <span className="eyebrow">{kicker}</span>
      <h3>{title}</h3>
      <p>{text}</p>
    </div>
  );
}

function KpiCard({
  label,
  value,
  icon,
  tone,
  loading,
  onClick,
  action,
}) {
  return (
    <button
      className={`kpi-card ${tone} ${onClick ? "clickable" : ""}`}
      onClick={onClick}
      disabled={!onClick}
    >
      <div className="kpi-topline">
        <div className="kpi-icon">
          <Icon name={icon} size={18} />
        </div>
        {onClick && <Icon name="more" size={17} />}
      </div>

      <span className="kpi-label">{label}</span>

      <strong className="kpi-value">
        {loading ? <span className="number-skeleton" /> : value}
      </strong>

      {action && <span className="kpi-action">{action}</span>}
    </button>
  );
}

function MovementBar({ label, value, max, icon }) {
  const width = Math.max(4, Math.round((Number(value || 0) / max) * 100));

  return (
    <div className="movement-bar-row">
      <div className="movement-label">
        <span className="mini-icon">
          <Icon name={icon} size={14} />
        </span>
        <span>{label}</span>
      </div>
      <div className="bar-track">
        <div className="bar-fill" style={{ width: `${width}%` }} />
      </div>
      <strong>{value}</strong>
    </div>
  );
}

function MetricRow({ label, value, positive = false }) {
  return (
    <div className="metric-row">
      <span>{label}</span>
      <strong className={positive && value > 0 ? "positive" : ""}>
        {positive && value > 0 ? "+" : ""}
        {value}
      </strong>
    </div>
  );
}

function Field({
  label,
  name,
  type = "text",
  value,
  onChange,
  placeholder,
  required = false,
  min,
  disabled = false,
  wide = false,
  step,
}) {
  return (
    <div className={`field ${wide ? "field-wide" : ""}`}>
      <label>{label}</label>
      <input
        name={name}
        type={type}
        value={value ?? ""}
        onChange={onChange}
        onInput={onChange}
        placeholder={placeholder}
        required={required}
        min={min}
        step={step}
        inputMode={type === "number" ? "numeric" : undefined}
        disabled={disabled}
      />
    </div>
  );
}

function SelectField({
  label,
  name,
  value,
  onChange,
  children,
  required = false,
  disabled = false,
}) {
  return (
    <div className="field">
      <label>{label}</label>
      <select
        name={name}
        value={value ?? ""}
        onChange={onChange}
        required={required}
        disabled={disabled}
      >
        {children}
      </select>
    </div>
  );
}

function MessageBox({ value }) {
  if (!value) return null;

  const [text, type] = value;

  return (
    <div className={`message ${type || "error"}`}>
      <Icon name={type === "success" ? "check" : "alert"} size={16} />
      <span>{text}</span>
    </div>
  );
}

function LoadingState({ text }) {
  return (
    <div className="empty-state">
      <Spinner dark />
      <strong>{text}</strong>
    </div>
  );
}

function EmptyState({ text, compact = false }) {
  return (
    <div className={`empty-state ${compact ? "compact" : ""}`}>
      <div className="empty-icon">
        <Icon name="archive" size={21} />
      </div>
      <strong>{text}</strong>
      {!compact && <span>Records will appear here as activity is recorded.</span>}
    </div>
  );
}

function QuantityBadge({ value, tone = "blue" }) {
  return <span className={`quantity-badge ${tone}`}>{value ?? 0}</span>;
}

function StatusBadge({ text, tone = "blue" }) {
  return <span className={`status-badge ${tone}`}>{text}</span>;
}

function MovementModal({ movement, close }) {
  return (
    <div className="modal-backdrop" onClick={close}>
      <div className="movement-modal" onClick={(event) => event.stopPropagation()}>
        <div className="modal-header">
          <div>
            <span className="eyebrow">MOVEMENT BREAKDOWN</span>
            <h2>Net movement details</h2>
          </div>
          <button className="icon-button" onClick={close} aria-label="Close">
            <Icon name="close" size={18} />
          </button>
        </div>

        <div className="movement-details">
          <MovementDetail label="Purchases" value={movement.purchases} icon="purchase" />
          <MovementDetail label="Transfer in" value={movement.transferIn} icon="arrowDown" />
          <MovementDetail label="Transfer out" value={movement.transferOut} icon="arrowUp" />
        </div>

        <div className="movement-total">
          <span>Net movement</span>
          <strong>{movement.netMovement}</strong>
        </div>

        <button className="secondary-button full-width" onClick={close}>
          Close details
        </button>
      </div>
    </div>
  );
}

function MovementDetail({ label, value, icon }) {
  return (
    <div className="movement-detail">
      <div>
        <span className="detail-icon">
          <Icon name={icon} size={15} />
        </span>
        <span>{label}</span>
      </div>
      <strong>{value}</strong>
    </div>
  );
}

function Spinner({ dark = false }) {
  return <span className={`spinner ${dark ? "dark" : ""}`} />;
}

function update(setter) {
  return (event) => {
    const { name, value } = event.target;
    setter((previous) => ({ ...previous, [name]: value }));
  };
}

function searchMatch(values, term) {
  if (!term) return true;
  const query = String(term).trim().toLowerCase();
  return values
    .map((value) => String(value ?? ""))
    .join(" ")
    .toLowerCase()
    .includes(query);
}

function labelFor(value) {
  const labels = {
    dashboard: "Dashboard",
    inventory: "Inventory",
    purchases: "Purchases",
    transfers: "Transfers",
    assignments: "Assignments",
    expenditures: "Expenditures",
    audit: "Audit Logs",
  };

  return labels[value] || value;
}

function formatDate(value) {
  if (!value) return "-";

  const raw = String(value);
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    return new Date(`${raw}T00:00:00`).toLocaleDateString("en-IN", {
      timeZone: "Asia/Kolkata",
      year: "numeric",
      month: "short",
      day: "2-digit",
    });
  }

  try {
    return new Date(value).toLocaleDateString("en-IN", {
      timeZone: "Asia/Kolkata",
      year: "numeric",
      month: "short",
      day: "2-digit",
    });
  } catch {
    return raw.split("T")[0];
  }
}

function formatDateTime(value) {
  if (!value) return "-";

  try {
    return new Date(value).toLocaleString("en-IN", {
      timeZone: "Asia/Kolkata",
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return String(value);
  }
}

function formatDetails(value) {
  if (!value) return "-";
  if (typeof value === "string") return value;

  try {
    return JSON.stringify(value);
  } catch {
    return "-";
  }
}

function Icon({ name, size = 20 }) {
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    "aria-hidden": true,
  };

  const icons = {
    shield: (
      <>
        <path d="M12 3l7 3v5c0 4.8-3 8.4-7 10-4-1.6-7-5.2-7-10V6l7-3z" />
        <path d="M9 12l2 2 4-4" />
      </>
    ),
    dashboard: (
      <>
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
        <rect x="14" y="14" width="7" height="7" rx="1" />
      </>
    ),
    inventory: (
      <>
        <path d="M4 7l8-4 8 4v10l-8 4-8-4V7z" />
        <path d="M4 7l8 4 8-4M12 11v10" />
      </>
    ),
    purchase: (
      <>
        <path d="M4 7h16l-1 13H5L4 7z" />
        <path d="M8 7V5h8v2M8 12h8M12 9v6" />
      </>
    ),
    transfer: (
      <>
        <path d="M4 7h13" />
        <path d="M14 4l3 3-3 3" />
        <path d="M20 17H7" />
        <path d="M10 14l-3 3 3 3" />
      </>
    ),
    assignments: (
      <>
        <circle cx="12" cy="8" r="3" />
        <path d="M5 20c.8-3.2 3.1-5 7-5s6.2 1.8 7 5" />
      </>
    ),
    assignment: (
      <>
        <circle cx="12" cy="8" r="3" />
        <path d="M5 20c.8-3.2 3.1-5 7-5s6.2 1.8 7 5" />
      </>
    ),
    expenditures: (
      <>
        <rect x="4" y="4" width="16" height="16" rx="2" />
        <path d="M8 9l4 4 4-4" />
      </>
    ),
    expenditure: (
      <>
        <rect x="4" y="4" width="16" height="16" rx="2" />
        <path d="M8 9l4 4 4-4" />
      </>
    ),
    audit: (
      <>
        <rect x="4" y="3" width="16" height="18" rx="2" />
        <path d="M8 8h8M8 12h8M8 16h5" />
      </>
    ),
    search: (
      <>
        <circle cx="11" cy="11" r="6" />
        <path d="M16 16l4 4" />
      </>
    ),
    bell: (
      <>
        <path d="M18 9a6 6 0 10-12 0c0 7-3 7-3 8h18c0-1-3-1-3-8" />
        <path d="M10 21h4" />
      </>
    ),
    logout: (
      <>
        <path d="M10 17l5-5-5-5M15 12H3" />
        <path d="M21 19V5a2 2 0 00-2-2h-6" />
      </>
    ),
    login: (
      <>
        <path d="M14 8l4 4-4 4M18 12H4" />
        <path d="M20 19V5a2 2 0 00-2-2h-5" />
      </>
    ),
    lock: (
      <>
        <rect x="5" y="10" width="14" height="11" rx="2" />
        <path d="M8 10V7a4 4 0 018 0v3" />
      </>
    ),
    activity: <path d="M3 12h4l2-6 4 12 2-6h6" />,
    archive: (
      <>
        <rect x="4" y="5" width="16" height="15" rx="2" />
        <path d="M4 9h16M9 13h6" />
      </>
    ),
    box: (
      <>
        <path d="M4 7l8-4 8 4v10l-8 4-8-4V7z" />
        <path d="M4 7l8 4 8-4M12 11v10" />
      </>
    ),
    calendar: (
      <>
        <rect x="3" y="5" width="18" height="16" rx="2" />
        <path d="M16 3v4M8 3v4M3 10h18" />
      </>
    ),
    filter: (
      <>
        <path d="M4 5h16M7 12h10M10 19h4" />
      </>
    ),
    arrowDown: (
      <>
        <path d="M12 4v15M6 13l6 6 6-6" />
      </>
    ),
    arrowUp: (
      <>
        <path d="M12 20V5M6 11l6-6 6 6" />
      </>
    ),
    arrowRight: (
      <>
        <path d="M4 12h15M14 6l6 6-6 6" />
      </>
    ),
    plus: <path d="M12 5v14M5 12h14" />,
    check: <path d="M5 12l4 4L19 6" />,
    alert: (
      <>
        <path d="M12 3l9 17H3L12 3z" />
        <path d="M12 9v4M12 16h.01" />
      </>
    ),
    close: <path d="M6 6l12 12M18 6L6 18" />,
    more: (
      <>
        <circle cx="5" cy="12" r="1" fill="currentColor" stroke="none" />
        <circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" />
        <circle cx="19" cy="12" r="1" fill="currentColor" stroke="none" />
      </>
    ),
    chevron: <path d="M7 10l5 5 5-5" />,
    spark: (
      <>
        <path d="M12 3l1.3 5.7L19 10l-5.7 1.3L12 17l-1.3-5.7L5 10l5.7-1.3L12 3z" />
        <path d="M19 17l.5 2.1L22 20l-2.5.9L19 23l-.5-2.1L16 20l2.5-.9L19 17z" />
      </>
    ),
  };

  return <svg {...common}>{icons[name] || icons.dashboard}</svg>;
}

const STYLES = `
:root {
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  color: #14213b;
  background: #f6f8fb;
  font-synthesis: none;
  text-rendering: optimizeLegibility;
}

html,
body,
#root {
  width: 100% !important;
  min-width: 320px;
  min-height: 100%;
  max-width: none !important;
  margin: 0 !important;
  padding: 0 !important;
  border: 0 !important;
  background: #f6f8fb;
}

body {
  min-height: 100vh;
}

* {
  box-sizing: border-box;
}

button,
input,
select {
  font: inherit;
}

button {
  -webkit-tap-highlight-color: transparent;
}

button:focus-visible,
input:focus-visible,
select:focus-visible {
  outline: 3px solid rgba(55, 104, 235, 0.17);
  outline-offset: 2px;
}

.app-shell {
  min-height: 100vh;
  display: flex;
  background:
    radial-gradient(circle at 84% 0%, rgba(81, 126, 241, 0.08), transparent 24%),
    #f6f8fb;
}

.sidebar {
  position: fixed;
  inset: 0 auto 0 0;
  width: 248px;
  background: #0b1424;
  color: #fff;
  display: flex;
  flex-direction: column;
  z-index: 40;
  border-right: 1px solid #18243a;
}

.brand-block {
  min-height: 84px;
  padding: 0 21px;
  display: flex;
  align-items: center;
  gap: 11px;
  border-bottom: 1px solid #1c2940;
}

.brand-mark,
.login-brand-mark {
  width: 41px;
  height: 41px;
  flex: 0 0 41px;
  display: grid;
  place-items: center;
  border-radius: 12px;
  background: #2563eb;
  color: #fff;
  box-shadow: 0 10px 26px rgba(37, 99, 235, 0.22);
}

.brand-name {
  font-size: 12px;
  font-weight: 850;
  letter-spacing: 0.12em;
}

.brand-subtitle {
  margin-top: 4px;
  color: #8090a8;
  font-size: 8px;
  font-weight: 800;
  letter-spacing: 0.22em;
}

.sidebar-search {
  margin: 16px 14px 8px;
  height: 38px;
  border: 1px solid #24324a;
  border-radius: 9px;
  display: flex;
  align-items: center;
  gap: 7px;
  color: #73819a;
  padding: 0 9px;
  background: #0f1a2d;
}

.sidebar-search input {
  width: 100%;
  border: 0;
  outline: 0;
  color: #dce4ef;
  background: transparent;
  font-size: 10px;
  min-width: 0;
}

.sidebar-search input::placeholder {
  color: #64728b;
}

.sidebar-search > span {
  color: #59677f;
  font-size: 8px;
  border: 1px solid #2a3750;
  border-radius: 4px;
  padding: 2px 4px;
}

.nav-heading {
  padding: 17px 21px 8px;
  color: #5e6d86;
  font-size: 9px;
  font-weight: 850;
  letter-spacing: 0.15em;
}

.nav-stack {
  padding: 3px 11px;
  overflow-y: auto;
  flex: 1;
  min-height: 0;
  scrollbar-width: thin;
}

.nav-button {
  width: 100%;
  height: 44px;
  margin: 3px 0;
  padding: 0 11px;
  border: 1px solid transparent;
  border-radius: 9px;
  background: transparent;
  color: #94a2b9;
  display: flex;
  align-items: center;
  gap: 10px;
  cursor: pointer;
  text-align: left;
  transition: 0.18s ease;
}

.nav-button:hover {
  color: #fff;
  background: #131f34;
}

.nav-button.active {
  color: #fff;
  background: #1d4ed8;
  border-color: rgba(255,255,255,0.06);
  box-shadow: 0 9px 21px rgba(29, 78, 216, 0.2);
}

.nav-button span:last-child {
  font-size: 11px;
  font-weight: 700;
}

.nav-icon {
  width: 29px;
  height: 29px;
  display: grid;
  place-items: center;
  color: inherit;
  border-radius: 8px;
}

.nav-button.active .nav-icon {
  background: rgba(255,255,255,0.11);
}

.sidebar-bottom {
  margin-top: auto;
  padding: 15px 13px 16px;
  border-top: 1px solid #1c2940;
  position: sticky;
  bottom: 0;
  background: #0b1424;
  z-index: 2;
}

.sidebar-status {
  display: flex;
  align-items: center;
  gap: 9px;
  padding: 5px 7px 13px;
}

.sidebar-status strong,
.sidebar-status span {
  display: block;
}

.sidebar-status strong {
  color: #b8c3d4;
  font-size: 9px;
}

.sidebar-status > div > span {
  color: #65728a;
  margin-top: 2px;
  font-size: 8px;
}

.online-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #1cc88a;
  box-shadow: 0 0 0 4px rgba(28, 200, 138, 0.08);
}

.signout-button {
  width: 100%;
  height: 41px;
  border: 1px solid #27354d;
  border-radius: 9px;
  background: #101a2c;
  color: #aeb9ca;
  display: flex;
  align-items: center;
  gap: 9px;
  padding: 0 12px;
  cursor: pointer;
  transition: 0.18s ease;
}

.signout-button:hover {
  color: #fff;
  border-color: #3a4964;
}

.signout-button span {
  font-size: 10px;
  font-weight: 700;
}

.main-area {
  width: calc(100% - 248px);
  margin-left: 248px;
  min-height: 100vh;
}

.topbar {
  height: 92px;
  padding: 0 31px;
  border-bottom: 1px solid #e6eaf0;
  background: rgba(255,255,255,0.94);
  backdrop-filter: blur(9px);
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 18px;
  position: sticky;
  top: 0;
  z-index: 25;
}

.breadcrumb {
  color: #8d98a9;
  font-size: 9px;
  margin-bottom: 5px;
}

.breadcrumb span {
  color: #c4cbd5;
  padding: 0 4px;
}

.topbar-copy h1 {
  margin: 0;
  color: #14213b;
  font-size: 20px;
  letter-spacing: -0.035em;
}

.topbar-copy p {
  margin: 4px 0 0;
  color: #8190a5;
  font-size: 10px;
}

.topbar-actions {
  display: flex;
  align-items: center;
  gap: 10px;
}

.icon-top-button {
  width: 37px;
  height: 37px;
  border-radius: 9px;
  border: 1px solid #e2e7ee;
  background: #fff;
  color: #6e7d93;
  cursor: pointer;
  display: grid;
  place-items: center;
  position: relative;
}

.notification-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #ef4444;
  position: absolute;
  top: 8px;
  right: 8px;
  border: 2px solid #fff;
}

.user-card {
  min-width: 188px;
  height: 53px;
  border: 1px solid #e2e7ee;
  border-radius: 11px;
  background: #fff;
  display: flex;
  align-items: center;
  gap: 9px;
  padding: 6px 9px;
}

.avatar {
  width: 34px;
  height: 34px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  background: #e9f0ff;
  color: #245fe0;
  font-size: 12px;
  font-weight: 850;
}

.user-text {
  display: flex;
  flex-direction: column;
  min-width: 0;
  flex: 1;
}

.user-text strong {
  color: #243047;
  font-size: 10px;
}

.user-text span {
  color: #8994a5;
  font-size: 8px;
  margin-top: 3px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.page-content {
  width: 100%;
  max-width: 1600px;
  margin: 0 auto;
  padding: 27px 31px 45px;
}

.section-kicker,
.eyebrow {
  color: #6b7c96;
  font-size: 8px;
  font-weight: 850;
  letter-spacing: 0.17em;
}

.hero-row {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 18px;
  margin-bottom: 19px;
}

.hero-row h2,
.section-intro-row h2,
.audit-hero h2 {
  margin: 4px 0 0;
  color: #15233d;
  font-size: 25px;
  letter-spacing: -0.045em;
  line-height: 1.08;
}

.hero-row p,
.section-intro-row p,
.audit-hero p {
  margin: 7px 0 0;
  color: #8390a4;
  font-size: 10px;
  line-height: 1.55;
}

.hero-date {
  min-width: 205px;
  padding: 10px 12px;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  background: #fff;
  display: flex;
  gap: 9px;
  align-items: center;
  color: #4c74cb;
}

.hero-date span,
.hero-date strong {
  display: block;
}

.hero-date span {
  color: #8b96a8;
  font-size: 8px;
}

.hero-date strong {
  color: #34415a;
  margin-top: 3px;
  font-size: 9px;
}

.filter-panel,
.panel,
.mini-filter-panel {
  background: #fff;
  border: 1px solid #e4e9f0;
  border-radius: 13px;
  box-shadow: 0 8px 30px rgba(15, 23, 42, 0.025);
}

.filter-panel {
  padding: 16px 17px;
  margin-bottom: 17px;
}

.filter-heading,
.panel-heading-row,
.table-panel-heading,
.section-intro-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 15px;
}

.filter-heading {
  margin-bottom: 14px;
}

.filter-heading h3 {
  margin: 4px 0 0;
  color: #29364d;
  font-size: 12px;
}

.ghost-button {
  height: 35px;
  padding: 0 10px;
  border: 1px solid #e1e6ed;
  background: #f8fafc;
  color: #50627e;
  border-radius: 8px;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  font-size: 9px;
  font-weight: 750;
}

.ghost-button:hover {
  background: #f1f5f9;
}

.filter-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(150px, 1fr));
  gap: 11px;
}

.field label {
  display: block;
  color: #69778d;
  font-size: 9px;
  font-weight: 750;
  margin-bottom: 6px;
}

.field input,
.field select {
  width: 100%;
  height: 39px;
  border: 1px solid #dfe5ec;
  border-radius: 8px;
  background: #fff;
  color: #2c3a52;
  font-size: 10px;
  padding: 0 10px;
  outline: none;
  transition: 0.18s ease;
}

.field input::placeholder {
  color: #a6afbd;
}

.field input:hover,
.field select:hover {
  border-color: #c4cdd9;
}

.field input:focus,
.field select:focus {
  border-color: #5d83df;
  box-shadow: 0 0 0 3px rgba(93, 131, 223, 0.11);
}

.field input:disabled,
.field select:disabled {
  background: #f5f6f8;
  color: #9aa4b3;
  cursor: not-allowed;
}

.kpi-grid {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 13px;
  margin-bottom: 18px;
}

.kpi-card {
  position: relative;
  min-height: 143px;
  border: 1px solid #e4e9f0;
  border-radius: 13px;
  padding: 16px;
  background: #fff;
  text-align: left;
  color: #16243c;
  box-shadow: 0 7px 26px rgba(15,23,42,0.035);
  overflow: hidden;
}

.kpi-card::before {
  content: "";
  position: absolute;
  left: 0;
  top: 0;
  right: 0;
  height: 3px;
  background: #7397e9;
}

.kpi-card.green::before { background: #20b486; }
.kpi-card.purple::before { background: #8b63e8; }
.kpi-card.amber::before { background: #f2b44d; }
.kpi-card.red::before { background: #ec6e79; }

.kpi-card.clickable {
  cursor: pointer;
  transition: 0.18s ease;
}

.kpi-card.clickable:hover {
  transform: translateY(-2px);
  box-shadow: 0 13px 31px rgba(15,23,42,0.08);
}

.kpi-card:disabled {
  cursor: default;
}

.kpi-topline {
  display: flex;
  justify-content: space-between;
  align-items: center;
  color: #9aa6b7;
}

.kpi-icon {
  width: 34px;
  height: 34px;
  border-radius: 9px;
  background: #eef4ff;
  color: #3570dd;
  display: grid;
  place-items: center;
}

.kpi-card.green .kpi-icon { color: #138c65; background: #e9f8f1; }
.kpi-card.purple .kpi-icon { color: #7450ce; background: #f2edff; }
.kpi-card.amber .kpi-icon { color: #b77a17; background: #fff5e2; }
.kpi-card.red .kpi-icon { color: #c84a55; background: #fff0f1; }

.kpi-label {
  display: block;
  margin-top: 14px;
  color: #7a8799;
  font-size: 9px;
  font-weight: 700;
}

.kpi-value {
  display: block;
  margin-top: 3px;
  color: #1b2a44;
  font-size: 28px;
  line-height: 1.05;
  letter-spacing: -0.04em;
}

.kpi-action {
  display: block;
  margin-top: 6px;
  color: #2963d9;
  font-size: 8px;
  font-weight: 800;
}

.number-skeleton {
  width: 48px;
  height: 26px;
  display: inline-block;
  border-radius: 5px;
  background: linear-gradient(90deg, #edf0f4, #f7f8fa, #edf0f4);
  background-size: 200% 100%;
  animation: shimmer 1.2s infinite;
}

.dashboard-main-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.28fr) minmax(330px, 0.72fr);
  gap: 17px;
}

.chart-card,
.position-card {
  padding: 19px;
  min-height: 300px;
}

.panel-heading {
  margin-bottom: 16px;
}

.panel-heading h3 {
  margin: 4px 0 0;
  color: #27344b;
  font-size: 14px;
}

.panel-heading p {
  margin: 4px 0 0;
  color: #8995a6;
  font-size: 9px;
}

.movement-chart {
  padding-top: 4px;
}

.movement-bar-row {
  display: grid;
  grid-template-columns: 106px minmax(0, 1fr) 34px;
  align-items: center;
  gap: 13px;
  margin: 26px 0;
}

.movement-label {
  display: flex;
  gap: 7px;
  align-items: center;
  color: #5e6b7f;
  font-size: 9px;
  font-weight: 700;
}

.mini-icon {
  width: 26px;
  height: 26px;
  border-radius: 7px;
  background: #eef4ff;
  color: #3b70dc;
  display: grid;
  place-items: center;
}

.bar-track {
  height: 8px;
  border-radius: 999px;
  background: #eef1f5;
  overflow: hidden;
}

.bar-fill {
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, #3169da, #7ca0f0);
  transition: width 0.35s ease;
}

.movement-bar-row > strong {
  color: #26354c;
  font-size: 11px;
  text-align: right;
}

.position-content {
  min-height: 208px;
  display: grid;
  grid-template-columns: 150px 1fr;
  gap: 21px;
  align-items: center;
}

.position-ring {
  --ring: 0%;
  width: 145px;
  height: 145px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  background: conic-gradient(#3169da var(--ring), #e8edf4 var(--ring));
  position: relative;
}

.position-ring::after {
  content: "";
  position: absolute;
  inset: 12px;
  background: #fff;
  border-radius: 50%;
}

.position-ring > div {
  position: relative;
  z-index: 1;
  text-align: center;
}

.position-ring strong,
.position-ring span {
  display: block;
}

.position-ring strong {
  color: #1e2d48;
  font-size: 27px;
}

.position-ring span {
  color: #8995a6;
  margin-top: 2px;
  font-size: 8px;
}

.position-metrics {
  border-left: 1px solid #edf0f4;
  padding-left: 17px;
}

.metric-row {
  display: flex;
  justify-content: space-between;
  padding: 11px 0;
  border-bottom: 1px solid #eff2f5;
  color: #7d899a;
  font-size: 9px;
}

.metric-row:last-child {
  border-bottom: 0;
}

.metric-row strong {
  color: #2a3850;
  font-size: 10px;
}

.metric-row .positive {
  color: #168362;
}

.lower-dashboard-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.25fr) minmax(330px, 0.75fr);
  gap: 17px;
  margin-top: 17px;
}

.activity-card,
.base-card {
  padding: 19px;
}

.activity-list {
  display: flex;
  flex-direction: column;
}

.activity-row {
  display: grid;
  grid-template-columns: 8px minmax(0, 1fr) auto;
  gap: 10px;
  align-items: center;
  padding: 11px 0;
  border-bottom: 1px solid #eff2f5;
}

.activity-row:last-child {
  border-bottom: 0;
}

.activity-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
}

.activity-dot.blue { background: #3775e1; }
.activity-dot.purple { background: #8e6ae7; }
.activity-dot.amber { background: #f0b348; }
.activity-dot.red { background: #e56b78; }

.activity-main > div {
  display: flex;
  align-items: center;
  gap: 7px;
}

.activity-main strong {
  color: #33415a;
  font-size: 9px;
}

.activity-main > span {
  display: block;
  margin-top: 4px;
  color: #8894a5;
  font-size: 8px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.activity-meta {
  text-align: right;
}

.activity-meta strong,
.activity-meta span {
  display: block;
}

.activity-meta strong {
  color: #536177;
  font-size: 8px;
}

.activity-meta span {
  color: #9aa4b2;
  font-size: 7px;
  margin-top: 3px;
}

.base-list {
  display: flex;
  flex-direction: column;
  gap: 13px;
  padding-top: 2px;
}

.base-row {
  display: grid;
  grid-template-columns: 112px minmax(0, 1fr) 34px;
  align-items: center;
  gap: 9px;
}

.base-row > div:first-child {
  display: flex;
  align-items: center;
  gap: 7px;
}

.base-rank {
  width: 23px;
  height: 23px;
  display: grid;
  place-items: center;
  border-radius: 7px;
  background: #f2f5f8;
  color: #8793a5;
  font-size: 7px;
  font-weight: 800;
}

.base-row strong {
  color: #46536a;
  font-size: 8px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.base-track {
  height: 7px;
  border-radius: 999px;
  overflow: hidden;
  background: #edf1f5;
}

.base-fill {
  height: 100%;
  background: linear-gradient(90deg, #5d8ae3, #b3c8f2);
  border-radius: inherit;
}

.base-quantity {
  color: #33415a;
  font-size: 9px;
  font-weight: 800;
  text-align: right;
}

.insight-strip {
  margin-top: 17px;
  min-height: 67px;
  border: 1px solid #e0e7f3;
  border-radius: 12px;
  padding: 11px 14px;
  display: flex;
  align-items: center;
  gap: 10px;
  background:
    radial-gradient(circle at 100% 50%, rgba(56, 104, 223, 0.08), transparent 35%),
    #fff;
}

.insight-icon {
  width: 35px;
  height: 35px;
  display: grid;
  place-items: center;
  border-radius: 9px;
  color: #3d6fd3;
  background: #edf3ff;
}

.insight-strip strong {
  display: block;
  color: #30405a;
  font-size: 10px;
  margin-top: 3px;
}

.insight-points {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 15px;
}

.insight-points span {
  color: #6e7f98;
  font-size: 8px;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  white-space: nowrap;
}

.insight-points svg {
  color: #1ca77b;
}

.panel-action-icon {
  width: 37px;
  height: 37px;
  display: grid;
  place-items: center;
  border-radius: 9px;
  color: #3a71da;
  background: #edf3ff;
}

.form-panel {
  padding: 20px;
  margin-bottom: 17px;
}

.form-panel .panel-heading-row {
  margin-bottom: 18px;
}

.panel-heading-row h2 {
  margin: 4px 0 0;
  color: #27344b;
  font-size: 15px;
}

.panel-heading-row p {
  margin: 5px 0 0;
  color: #8793a5;
  font-size: 9px;
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 13px;
}

.field-wide {
  grid-column: 1 / -1;
}

.form-footer {
  margin-top: 18px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.form-security {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: #8a95a6;
  font-size: 8px;
}

.primary-button,
.secondary-button {
  min-height: 40px;
  padding: 0 14px;
  border-radius: 8px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  cursor: pointer;
  border: 0;
  font-size: 9px;
  font-weight: 800;
}

.primary-button {
  color: #fff;
  background: #2458d9;
  box-shadow: 0 9px 21px rgba(36, 88, 217, 0.18);
}

.primary-button:hover:not(:disabled) {
  background: #1e4cc1;
}

.primary-button:disabled,
.secondary-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.form-submit {
  min-width: 158px;
}

.secondary-button {
  background: #f2f5f8;
  color: #40516c;
  border: 1px solid #e1e6ec;
}

.secondary-button:hover {
  background: #ebeff4;
}

.full-width {
  width: 100%;
}

.message {
  margin-top: 13px;
  padding: 10px 11px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  gap: 7px;
  font-size: 9px;
  font-weight: 750;
}

.message.success {
  color: #176b52;
  background: #eaf8f2;
  border: 1px solid #ccefe0;
}

.message.error {
  color: #a23f45;
  background: #fff1f2;
  border: 1px solid #f2d0d3;
}

.permission-notice {
  display: flex;
  align-items: center;
  gap: 11px;
  border: 1px solid #e3e7ed;
  background: #fff;
  border-radius: 12px;
  padding: 14px 15px;
  margin-bottom: 17px;
}

.permission-icon {
  width: 35px;
  height: 35px;
  display: grid;
  place-items: center;
  border-radius: 9px;
  background: #f1f3f6;
  color: #67758a;
}

.permission-notice strong,
.permission-notice p {
  display: block;
}

.permission-notice strong {
  margin-top: 3px;
  color: #3a465b;
  font-size: 10px;
}

.permission-notice p {
  margin: 4px 0 0;
  color: #8b96a7;
  font-size: 8px;
}

.table-panel {
  padding: 19px;
}

.table-panel-heading {
  margin-bottom: 15px;
}

.table-panel-heading h2 {
  margin: 4px 0 0;
  color: #27344b;
  font-size: 14px;
}

.record-pill {
  padding: 6px 9px;
  background: #f3f5f8;
  border-radius: 999px;
  color: #728097;
  font-size: 8px;
  font-weight: 800;
}

.table-scroll {
  width: 100%;
  overflow-x: auto;
  border: 1px solid #edf0f4;
  border-radius: 9px;
}

.data-table {
  width: 100%;
  min-width: 820px;
  border-collapse: collapse;
}

.data-table th {
  padding: 10px 11px;
  background: #f8fafc;
  color: #7b8799;
  text-align: left;
  border-bottom: 1px solid #e7ebf0;
  font-size: 8px;
  font-weight: 850;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  white-space: nowrap;
}

.data-table td {
  padding: 11px;
  border-bottom: 1px solid #eef1f4;
  color: #4c596f;
  font-size: 9px;
  white-space: nowrap;
  vertical-align: middle;
}

.data-table tbody tr:last-child td {
  border-bottom: 0;
}

.data-table tbody tr:hover {
  background: #fafcff;
}

.route-cell {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: #53637b;
}

.route-cell svg {
  color: #8392a8;
}

.quantity-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 31px;
  padding: 5px 8px;
  border-radius: 999px;
  font-size: 8px;
  font-weight: 850;
}

.quantity-badge.blue {
  color: #285dc6;
  background: #eaf1ff;
}

.quantity-badge.purple {
  color: #7350c7;
  background: #f1ecff;
}

.quantity-badge.amber {
  color: #ad7417;
  background: #fff5df;
}

.quantity-badge.red {
  color: #c34b56;
  background: #ffeff0;
}

.status-badge {
  display: inline-flex;
  align-items: center;
  padding: 5px 8px;
  border-radius: 999px;
  font-size: 7px;
  font-weight: 850;
  letter-spacing: 0.05em;
  text-transform: uppercase;
}

.status-badge.blue {
  color: #2b63cf;
  background: #eaf1ff;
}

.status-badge.green {
  color: #158264;
  background: #e9f8f1;
}

.status-badge.purple {
  color: #7350c7;
  background: #f1ecff;
}

.status-badge.amber {
  color: #ad7417;
  background: #fff5df;
}

.status-badge.red {
  color: #c34b56;
  background: #ffeff0;
}

.empty-state {
  min-height: 210px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  gap: 6px;
  color: #8a95a6;
  text-align: center;
}

.empty-state.compact {
  min-height: 132px;
}

.empty-icon {
  width: 43px;
  height: 43px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  background: #f1f4f7;
  color: #8390a4;
  margin-bottom: 2px;
}

.empty-state strong {
  color: #59667c;
  font-size: 9px;
}

.empty-state > span {
  color: #969fac;
  font-size: 8px;
}

.section-intro-row {
  margin-bottom: 17px;
}

.section-intro-row h2 {
  font-size: 22px;
}

.mini-summary {
  min-width: 110px;
  border: 1px solid #e3e8ee;
  background: #fff;
  border-radius: 10px;
  padding: 9px 12px;
  text-align: right;
}

.mini-summary span,
.mini-summary strong {
  display: block;
}

.mini-summary span {
  color: #8b96a7;
  font-size: 8px;
}

.mini-summary strong {
  color: #253650;
  font-size: 18px;
  margin-top: 2px;
}

.mini-filter-panel {
  padding: 14px;
  display: grid;
  grid-template-columns: minmax(180px, 1fr) minmax(180px, 1fr) 1.5fr;
  gap: 12px;
  align-items: end;
  margin-bottom: 17px;
}

.search-hint {
  min-height: 39px;
  border: 1px dashed #dbe2ea;
  border-radius: 8px;
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 0 11px;
  color: #8995a7;
  font-size: 8px;
}

.audit-hero {
  min-height: 100px;
  padding: 18px;
  display: flex;
  align-items: center;
  gap: 12px;
  border: 1px solid #dfe7f4;
  border-radius: 13px;
  background:
    radial-gradient(circle at 100% 20%, rgba(74, 116, 221, 0.11), transparent 30%),
    #f7faff;
  margin-bottom: 17px;
}

.audit-icon {
  width: 44px;
  height: 44px;
  display: grid;
  place-items: center;
  border-radius: 11px;
  background: #e8f0ff;
  color: #356ed8;
}

.audit-hero h2 {
  font-size: 20px;
}

.audit-count {
  margin-left: auto;
  text-align: right;
}

.audit-count strong,
.audit-count span {
  display: block;
}

.audit-count strong {
  color: #31528f;
  font-size: 22px;
}

.audit-count span {
  margin-top: 2px;
  color: #7a8ba9;
  font-size: 8px;
}

.modal-backdrop {
  position: fixed;
  inset: 0;
  z-index: 100;
  display: grid;
  place-items: center;
  padding: 18px;
  background: rgba(15, 23, 42, 0.52);
  backdrop-filter: blur(3px);
}

.movement-modal {
  width: min(470px, 100%);
  background: #fff;
  border-radius: 14px;
  padding: 19px;
  box-shadow: 0 25px 70px rgba(0,0,0,0.22);
}

.modal-header {
  display: flex;
  justify-content: space-between;
  gap: 14px;
  border-bottom: 1px solid #edf0f4;
  padding-bottom: 13px;
  margin-bottom: 4px;
}

.modal-header h2 {
  margin: 4px 0 0;
  color: #27344b;
  font-size: 15px;
}

.icon-button {
  width: 32px;
  height: 32px;
  border: 0;
  border-radius: 8px;
  background: #f1f3f6;
  color: #69768a;
  display: grid;
  place-items: center;
  cursor: pointer;
}

.icon-button:hover {
  background: #e9edf2;
}

.movement-detail {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 13px 3px;
  border-bottom: 1px solid #eef1f4;
}

.movement-detail > div {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #59677b;
  font-size: 9px;
  font-weight: 700;
}

.detail-icon {
  width: 27px;
  height: 27px;
  display: grid;
  place-items: center;
  border-radius: 7px;
  background: #edf3ff;
  color: #3a70d9;
}

.movement-detail strong {
  color: #28364d;
  font-size: 11px;
}

.movement-total {
  display: flex;
  justify-content: space-between;
  padding: 17px 3px;
  color: #2f3d54;
  font-size: 10px;
  font-weight: 800;
}

.movement-total strong {
  color: #168362;
  font-size: 18px;
}

.toast {
  position: fixed;
  right: 20px;
  bottom: 20px;
  min-width: 250px;
  max-width: 420px;
  padding: 11px 13px;
  border-radius: 9px;
  display: flex;
  gap: 8px;
  align-items: center;
  z-index: 110;
  font-size: 9px;
  font-weight: 750;
  box-shadow: 0 15px 35px rgba(15,23,42,0.15);
}

.toast.success {
  color: #176951;
  background: #eaf8f2;
  border: 1px solid #ccefe0;
}

.toast.error {
  color: #a13f47;
  background: #fff1f2;
  border: 1px solid #f2d0d3;
}

.login-page {
  min-height: 100vh;
  width: 100%;
  display: grid;
  place-items: center;
  padding: 25px;
  background:
    radial-gradient(circle at 13% 10%, rgba(82, 120, 218, 0.10), transparent 25%),
    radial-gradient(circle at 90% 90%, rgba(61, 101, 194, 0.07), transparent 25%),
    #eef2f8;
}

.login-shell {
  width: min(1110px, 100%);
  min-height: 650px;
  display: grid;
  grid-template-columns: 0.93fr 1.07fr;
  overflow: hidden;
  border: 1px solid #dfe6ef;
  border-radius: 22px;
  background: #fff;
  box-shadow: 0 30px 85px rgba(15, 23, 42, 0.12);
}

.login-intro {
  position: relative;
  overflow: hidden;
  color: #fff;
  padding: 29px 35px 28px;
  background:
    radial-gradient(circle at 70% 55%, rgba(73, 113, 207, 0.18), transparent 31%),
    linear-gradient(145deg, #0b172a 0%, #101e35 55%, #0b1424 100%);
}

.login-intro::before,
.login-intro::after {
  content: "";
  position: absolute;
  border: 1px solid rgba(115, 156, 238, 0.10);
  border-radius: 50%;
  pointer-events: none;
}

.login-intro::before {
  width: 420px;
  height: 420px;
  right: -220px;
  bottom: -165px;
}

.login-intro::after {
  width: 310px;
  height: 310px;
  right: -165px;
  bottom: -115px;
}

.login-brand-row {
  display: flex;
  align-items: center;
  gap: 11px;
  position: relative;
  z-index: 1;
}

.login-brand-row strong,
.login-brand-row span,
.mobile-brand strong,
.mobile-brand span {
  display: block;
}

.login-brand-row strong,
.mobile-brand strong {
  color: #fff;
  font-size: 13px;
  letter-spacing: 0.10em;
  font-weight: 850;
}

.login-brand-row span,
.mobile-brand span {
  margin-top: 5px;
  color: #91a6c5;
  font-size: 8px;
  letter-spacing: 0.20em;
  font-weight: 800;
}

.login-intro-content {
  position: relative;
  z-index: 1;
  max-width: 575px;
  margin: 82px auto 0;
  text-align: center;
}

.login-intro-content .section-kicker {
  color: #7ea7ff;
}

.login-intro-content h1 {
  margin: 22px 0 0;
  color: #fff;
  font-size: 43px;
  line-height: 1.03;
  letter-spacing: -0.055em;
}

.login-intro-content > p {
  margin: 17px auto 0;
  max-width: 540px;
  color: #adbed7;
  font-size: 11px;
  line-height: 1.7;
}

.login-feature-list {
  margin-top: 43px;
  display: grid;
  gap: 18px;
  text-align: left;
}

.feature-item {
  display: grid;
  grid-template-columns: 36px 1fr;
  gap: 10px;
  align-items: center;
}

.feature-icon {
  width: 36px;
  height: 36px;
  display: grid;
  place-items: center;
  border-radius: 9px;
  background: rgba(66, 110, 200, 0.14);
  border: 1px solid rgba(117, 156, 231, 0.19);
  color: #89afff;
}

.feature-item strong,
.feature-item span {
  display: block;
}

.feature-item strong {
  color: #fff;
  font-size: 10px;
}

.feature-item span {
  color: #7f96b8;
  font-size: 8px;
  margin-top: 4px;
}

.login-intro-footer {
  position: absolute;
  left: 35px;
  bottom: 28px;
  z-index: 1;
  display: flex;
  gap: 7px;
  align-items: center;
  color: #6f86a8;
  font-size: 8px;
  font-weight: 800;
  letter-spacing: 0.08em;
}

.login-intro-footer i {
  color: #34507e;
  font-style: normal;
}

.login-form-side {
  padding: 66px 70px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  background: #fff;
}

.mobile-brand {
  display: none;
}

.login-heading {
  text-align: center;
  margin-bottom: 36px;
}

.login-heading .section-kicker {
  color: #6d7f99;
}

.login-heading h2 {
  margin: 9px 0 0;
  color: #14213b;
  font-size: 35px;
  letter-spacing: -0.055em;
}

.login-heading p {
  margin: 8px 0 0;
  color: #8a96a7;
  font-size: 11px;
}

.login-form {
  width: min(480px, 100%);
  margin: 0 auto;
  display: grid;
  gap: 18px;
}

.login-form .field label {
  text-align: left;
  font-size: 9px;
  color: #58677e;
}

.login-form .field input {
  height: 48px;
  font-size: 11px;
}

.login-submit {
  height: 48px;
  margin-top: 3px;
  font-size: 11px;
}

.login-security {
  width: min(480px, 100%);
  margin: 30px auto 0;
  padding-top: 17px;
  border-top: 1px solid #edf0f4;
  color: #8d99a9;
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 7px;
  font-size: 8px;
}

.login-security i {
  color: #c6ccd5;
  font-style: normal;
}

.spinner {
  width: 14px;
  height: 14px;
  border: 2px solid rgba(255,255,255,0.42);
  border-top-color: currentColor;
  border-radius: 50%;
  display: inline-block;
  animation: spin 0.7s linear infinite;
}

.spinner.dark {
  color: #5272a5;
  border-color: rgba(82,114,165,0.20);
  border-top-color: currentColor;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

@keyframes shimmer {
  0% { background-position: 0 0; }
  100% { background-position: 200% 0; }
}

@media (max-width: 1220px) {
  .kpi-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .dashboard-main-grid,
  .lower-dashboard-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 900px) {
  .sidebar {
    width: 76px;
  }

  .brand-block {
    padding: 0;
    justify-content: center;
  }

  .brand-block > div:last-child,
  .sidebar-search,
  .nav-heading,
  .nav-button > span:last-child,
  .sidebar-status div,
  .signout-button > span {
    display: none;
  }

  .nav-button {
    justify-content: center;
    padding: 0;
  }

  .sidebar-bottom {
    padding: 14px 10px;
    position: sticky;
    bottom: 0;
  }

  .sidebar-status {
    justify-content: center;
  }

  .signout-button {
    justify-content: center;
    padding: 0;
  }

  .main-area {
    width: calc(100% - 76px);
    margin-left: 76px;
  }

  .topbar {
    padding: 0 18px;
  }

  .page-content {
    padding: 22px 18px 35px;
  }

  .user-text,
  .user-card > svg {
    display: none;
  }

  .user-card {
    min-width: 43px;
    padding: 5px;
  }

  .filter-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .login-shell {
    width: min(820px, 100%);
    grid-template-columns: 1fr;
  }

  .login-intro {
    min-height: 410px;
  }

  .login-intro-content {
    margin-top: 52px;
  }

  .login-intro-content h1 {
    font-size: 36px;
  }

  .login-intro-footer {
    position: static;
    margin-top: 28px;
  }

  .login-form-side {
    padding: 45px 55px 48px;
  }
}

@media (max-width: 650px) {
  .login-page {
    padding: 0;
  }

  .login-shell {
    min-height: 100vh;
    border-radius: 0;
    border: 0;
  }

  .login-intro {
    display: none;
  }

  .login-form-side {
    padding: 28px 20px;
  }

  .mobile-brand {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 52px;
    align-self: center;
  }

  .mobile-brand strong {
    color: #243149;
  }

  .mobile-brand span {
    color: #8693a6;
  }

  .login-heading h2 {
    font-size: 31px;
  }

  .topbar {
    height: auto;
    min-height: 80px;
    padding: 13px 13px;
  }

  .topbar-copy p {
    display: none;
  }

  .topbar-copy h1 {
    font-size: 17px;
  }

  .page-content {
    padding: 16px 11px 28px;
  }

  .hero-row,
  .section-intro-row {
    align-items: stretch;
    flex-direction: column;
  }

  .hero-date,
  .mini-summary {
    width: 100%;
  }

  .kpi-grid,
  .filter-grid,
  .form-grid,
  .mini-filter-panel {
    grid-template-columns: 1fr;
  }

  .form-footer {
    flex-direction: column;
    align-items: stretch;
  }

  .form-submit {
    width: 100%;
  }

  .insight-strip,
  .insight-points {
    flex-direction: column;
    align-items: flex-start;
  }

  .insight-points {
    margin-left: 0;
    gap: 7px;
  }

  .position-content {
    grid-template-columns: 1fr;
    justify-items: center;
  }

  .position-metrics {
    width: 100%;
    border-left: 0;
    padding-left: 0;
  }

  .audit-hero {
    align-items: flex-start;
  }

  .audit-count {
    display: none;
  }

  .toast {
    left: 10px;
    right: 10px;
    bottom: 10px;
    min-width: 0;
  }
}
`;

export default App;
