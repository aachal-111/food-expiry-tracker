import { useEffect, useState } from "react";
import { supabase } from "./supabaseClient";
import "./App.css";

const emptyFood = {
  name: "",
  category: "",
  quantity: "",
  purchase_date: "",
  expiry_date: "",
};

const categories = [
  "Fruits",
  "Vegetables",
  "Dairy",
  "Bakery",
  "Meat",
  "Other",
];

function getStatus(date) {
  if (!date) return "Unknown";

  const today = new Date();

  const current = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate()
  );

  const expiry = new Date(date + "T00:00:00");
  const days = Math.round((expiry - current) / 86400000);

  if (days < 0) return "Expired";
  if (days <= 3) return "Expiring Soon";

  return "Fresh";
}

function App() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const [page, setPage] = useState("login");
  const [menuOpen, setMenuOpen] = useState(false);
  const [register, setRegister] = useState(false);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");

  const [foods, setFoods] = useState([]);
  const [food, setFood] = useState({ ...emptyFood });
  const [editingId, setEditingId] = useState(null);

  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");

  // Check login session
  useEffect(() => {
    let active = true;

    supabase.auth.getSession().then(({ data, error }) => {
      if (!active) return;

      if (error) {
        setMessage(error.message);
      }

      setSession(data?.session ?? null);
      setLoading(false);
    });

    const { data: listener } =
      supabase.auth.onAuthStateChange(
        (_event, newSession) => {
          setSession(newSession);
          setLoading(false);
        }
      );

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  // Load food items after login
  useEffect(() => {
    if (!session?.user) {
      setFoods([]);
      setPage("login");
      return;
    }

    setPage("dashboard");

    let active = true;

    async function loadFoods() {
      const { data, error } = await supabase
        .from("food_items")
        .select("*")
        .eq("user_id", session.user.id)
        .order("created_at", { ascending: false });

      if (!active) return;

      if (error) {
        setMessage(error.message);
      } else {
        setFoods(data || []);
      }
    }

    loadFoods();

    return () => {
      active = false;
    };
  }, [session?.user?.id]);

  // Login and registration
  async function handleAuth(e) {
    e.preventDefault();

    setMessage("");
    setBusy(true);

    try {
      const result = register
        ? await supabase.auth.signUp({
            email,
            password,
          })
        : await supabase.auth.signInWithPassword({
            email,
            password,
          });

      if (result.error) {
        setMessage(result.error.message);
      } else if (register && !result.data.session) {
        setMessage(
          "Account created. Check your email to confirm registration, then log in."
        );
      } else {
        setMessage("");
      }
    } catch (error) {
      setMessage(error.message);
    } finally {
      setBusy(false);
    }
  }

  // Refresh saved food items
  async function refreshFoods() {
    if (!session?.user) return;

    const { data, error } = await supabase
      .from("food_items")
      .select("*")
      .eq("user_id", session.user.id)
      .order("created_at", { ascending: false });

    if (error) {
      setMessage(error.message);
    } else {
      setFoods(data || []);
    }
  }

  // Save or update food
  async function saveFood(e) {
    e.preventDefault();

    if (!session?.user) return;

    setMessage("");

    if (
      food.purchase_date &&
      food.expiry_date &&
      food.expiry_date < food.purchase_date
    ) {
      setMessage(
        "Expiry Date cannot be earlier than Purchase Date."
      );
      return;
    }

    setBusy(true);

    try {
      const payload = {
        name: food.name.trim(),
        category: food.category,
        quantity: Number(food.quantity),
        purchase_date: food.purchase_date,
        expiry_date: food.expiry_date,
        user_id: session.user.id,
      };

      const query = editingId
        ? supabase
            .from("food_items")
            .update(payload)
            .eq("id", editingId)
            .eq("user_id", session.user.id)
        : supabase
            .from("food_items")
            .insert(payload);

      const { error } = await query;

      if (error) {
        setMessage(error.message);
        return;
      }

      setFood({ ...emptyFood });
      setEditingId(null);

      await refreshFoods();
      setPage("list");
    } catch (error) {
      setMessage(error.message);
    } finally {
      setBusy(false);
    }
  }

  // Delete food
  async function deleteFood(id) {
    if (!window.confirm("Delete this food item?")) return;
    if (!session?.user) return;

    const { error } = await supabase
      .from("food_items")
      .delete()
      .eq("id", id)
      .eq("user_id", session.user.id);

    if (error) {
      setMessage(error.message);
    } else {
      await refreshFoods();
    }
  }

  // Edit existing food
  function editFood(item) {
    setFood({
      name: item.name,
      category: item.category,
      quantity: item.quantity,
      purchase_date: item.purchase_date,
      expiry_date: item.expiry_date,
    });

    setEditingId(item.id);
    setMessage("");
    setMenuOpen(false);
    setPage("add");
  }

  // Open Add Food page
  function openAdd() {
    setFood({ ...emptyFood });
    setEditingId(null);
    setMessage("");
    setMenuOpen(false);
    setPage("add");
  }

  // Return to dashboard
  function goBack() {
    setMessage("");
    setMenuOpen(false);
    setPage("dashboard");
  }

  // Open native date picker where supported
  function openDatePicker(e) {
    const input = e.currentTarget;

    if (typeof input.showPicker === "function") {
      try {
        input.showPicker();
      } catch {
        // Use the browser's normal date picker.
      }
    }
  }

  // Logout
  async function logout() {
    setMenuOpen(false);

    const { error } = await supabase.auth.signOut();

    if (error) {
      setMessage(error.message);
    }
  }

  // Dashboard statistics
  const fresh = foods.filter(
    (f) => getStatus(f.expiry_date) === "Fresh"
  ).length;

  const expiring = foods.filter(
    (f) => getStatus(f.expiry_date) === "Expiring Soon"
  ).length;

  const expired = foods.filter(
    (f) => getStatus(f.expiry_date) === "Expired"
  ).length;

  // Search and filter food items
  const filteredFoods = foods.filter((f) => {
    return (
      f.name.toLowerCase().includes(search.toLowerCase()) &&
      (categoryFilter === "All" ||
        f.category === categoryFilter) &&
      (statusFilter === "All" ||
        getStatus(f.expiry_date) === statusFilter)
    );
  });

  if (loading) {
    return <div className="phone">Loading...</div>;
  }

  return (
    <div className="phone">

      {/* HEADER */}
      <header className="app-header">
        <span>🌿 Food Expiry Tracker</span>

        <button
          type="button"
          className="menu-toggle"
          aria-label={
            menuOpen ? "Close menu" : "Open menu"
          }
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen(!menuOpen)}
        >
          ☰
        </button>
      </header>

      {/* HAMBURGER MENU */}
      {menuOpen && (
        <nav className="app-nav">
          {session ? (
            <>
              <button
                type="button"
                onClick={() => {
                  setPage("dashboard");
                  setMenuOpen(false);
                }}
              >
                Dashboard
              </button>

              <button
                type="button"
                onClick={() => {
                  setPage("list");
                  setMenuOpen(false);
                }}
              >
                Food Items
              </button>

              <button
                type="button"
                onClick={openAdd}
              >
                Add Food
              </button>

              <button
                type="button"
                onClick={logout}
              >
                Logout
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => {
                  setRegister(false);
                  setMenuOpen(false);
                }}
              >
                Login
              </button>

              <button
                type="button"
                onClick={() => {
                  setRegister(true);
                  setMenuOpen(false);
                }}
              >
                Register
              </button>
            </>
          )}
        </nav>
      )}

      {/* ERROR OR SUCCESS MESSAGE */}
      {message && (
        <p
          role="alert"
          style={{
            color: "#ffb4a8",
            fontSize: 13,
          }}
        >
          {message}
        </p>
      )}

      {/* LOGIN AND REGISTRATION */}
      {!session && (
        <section>
          <h3>Login Register</h3>

          <div className="welcome">
            <strong>
              {register
                ? "Create Account"
                : "Welcome Back"}
            </strong>

            <p>
              {register
                ? "Register your account"
                : "Login to your account"}
            </p>
          </div>

          <form onSubmit={handleAuth}>
            <input
              type="email"
              placeholder="✉ Email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) =>
                setEmail(e.target.value)
              }
            />

            <input
              type="password"
              placeholder="🔒 Password"
              autoComplete={
                register
                  ? "new-password"
                  : "current-password"
              }
              minLength={6}
              required
              value={password}
              onChange={(e) =>
                setPassword(e.target.value)
              }
            />

            <button
              className="green"
              disabled={busy}
            >
              {busy
                ? "Please wait..."
                : register
                ? "Register"
                : "Login"}
            </button>
          </form>

          <button
            type="button"
            className="outline"
            onClick={() => {
              setRegister(!register);
              setMessage("");
            }}
          >
            {register
              ? "Already have an account? Login"
              : "Don't have an account? Register"}
          </button>
        </section>
      )}

      {/* DASHBOARD */}
      {session && page === "dashboard" && (
        <section>
          <div className="welcome">
          <strong>Hello, {session?.user?.email?.split("@")[0] || "User"}!</strong>
            <p>Here is your food summary.</p>
          </div>

          <div className="stats">
            <div className="stat green-card">
              <b>{foods.length}</b>
              <span>Total Food Items</span>
            </div>

            <div className="stat green-card">
              <b>{fresh}</b>
              <span>Fresh Items</span>
            </div>

            <div className="stat yellow-card">
              <b>{expiring}</b>
              <span>Expiring Soon</span>
            </div>

            <div className="stat red-card">
              <b>{expired}</b>
              <span>Expired Items</span>
            </div>
          </div>

          <button
            type="button"
            className="green"
            onClick={openAdd}
          >
            + Add Food
          </button>

          <div className="between">
            <strong>Recent Items</strong>

            <button
              type="button"
              onClick={() => setPage("list")}
            >
              View all
            </button>
          </div>

          {foods.length === 0 && (
            <p>
              No food items yet. Add your first food!
            </p>
          )}

         {foods.slice(0, 3).map((f) => (
  <div
    className={`recent ${getStatus(f.expiry_date)
      .toLowerCase()
      .replaceAll(" ", "-")}`}
    key={f.id}
  >
              <span>
                {f.name}
                <small>{f.category}</small>
              </span>

              <b className="status">
                {getStatus(f.expiry_date)}
              </b>
            </div>
          ))}
        </section>
      )}

      {/* ADD AND EDIT FOOD */}
      {session && page === "add" && (
        <section>
          <div className="add-heading">
            <button
              type="button"
              className="back-arrow"
              aria-label="Back to dashboard"
              onClick={goBack}
            >
              ←
            </button>

            <h3>
              {editingId
                ? "Edit Food Item"
                : "Add Food Item"}
            </h3>
          </div>

          <form onSubmit={saveFood}>
            <label htmlFor="food-name">
              Food Name
            </label>

            <input
              id="food-name"
              type="text"
              required
              placeholder="Enter food name"
              value={food.name}
              onChange={(e) =>
                setFood({
                  ...food,
                  name: e.target.value,
                })
              }
            />

            <label htmlFor="food-category">
              Category
            </label>

            <select
              id="food-category"
              required
              value={food.category}
              onChange={(e) =>
                setFood({
                  ...food,
                  category: e.target.value,
                })
              }
            >
              <option value="">
                Select category
              </option>

              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>

            <label htmlFor="food-quantity">
              Quantity
            </label>

            <input
              id="food-quantity"
              type="number"
              min="1"
              step="1"
              required
              placeholder="Enter your quantity"
              value={food.quantity}
              onChange={(e) =>
                setFood({
                  ...food,
                  quantity: e.target.value,
                })
              }
            />

            <label htmlFor="purchase-date">
              Purchase Date
            </label>

            <input
              id="purchase-date"
              type="date"
              required
              value={food.purchase_date}
              onChange={(e) =>
                setFood({
                  ...food,
                  purchase_date: e.target.value,
                })
              }
              onClick={openDatePicker}
            />

            <label htmlFor="expiry-date">
              Expiry Date
            </label>

            <input
              id="expiry-date"
              type="date"
              required
              min={food.purchase_date || undefined}
              value={food.expiry_date}
              onChange={(e) =>
                setFood({
                  ...food,
                  expiry_date: e.target.value,
                })
              }
              onClick={openDatePicker}
            />

            <button
              className="green"
              disabled={busy}
            >
              {busy
                ? "Saving..."
                : editingId
                ? "Update Food"
                : "Save"}
            </button>
          </form>

          <button
            type="button"
            className="outline"
            onClick={goBack}
          >
            Back to Dashboard
          </button>
        </section>
      )}

      {/* FOOD ITEMS LIST */}
      {session && page === "list" && (
        <section>
          <div className="add-heading">
  <button
    type="button"
    className="back-arrow"
    aria-label="Back to dashboard"
    onClick={goBack}
  >
    ←
  </button>

  <h3>Food Items</h3>
</div>

          <input
            type="search"
            placeholder="🔍 Search food items..."
            value={search}
            onChange={(e) =>
              setSearch(e.target.value)
            }
          />

          <div className="between">
            <select
              aria-label="Filter by category"
              value={categoryFilter}
              onChange={(e) =>
                setCategoryFilter(e.target.value)
              }
            >
              <option value="All">
                Filter by category
              </option>

              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>

            <select
              aria-label="Filter by status"
              value={statusFilter}
              onChange={(e) =>
                setStatusFilter(e.target.value)
              }
            >
              <option value="All">
                Filter by status
              </option>

              <option value="Fresh">
                Fresh
              </option>

              <option value="Expiring Soon">
                Expiring Soon
              </option>

              <option value="Expired">
                Expired
              </option>
            </select>
          </div>

          <button
            type="button"
            className="green"
            onClick={openAdd}
          >
            + Add Food
          </button>

          {filteredFoods.length === 0 && (
            <p>
              No matching food items found.
            </p>
          )}

          {filteredFoods.map((f) => (
            <div
  className={`food-card ${getStatus(f.expiry_date)
    .toLowerCase()
    .replaceAll(" ", "-")}`}
  key={f.id}
>
              <strong>
                {f.name} — {getStatus(f.expiry_date)}
              </strong>

              <p>Category: {f.category}</p>
              <p>Quantity: {f.quantity}</p>
              <p>Purchase: {f.purchase_date}</p>
              <p>Expiry: {f.expiry_date}</p>

              <button
                type="button"
                onClick={() => editFood(f)}
              >
                Edit
              </button>{" "}

              <button
                type="button"
                onClick={() => deleteFood(f.id)}
              >
                Delete
              </button>
            </div>
          ))}

          <button
            type="button"
            className="outline"
            onClick={goBack}
          >
            Back to Dashboard
          </button>
        </section>
      )}
    </div>
  );
}

export default App;
