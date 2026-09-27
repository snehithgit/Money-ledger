import { Route, Routes } from "react-router-dom";
import Layout from "./components/Layout";
import Dashboard from "./pages/Dashboard";
import Transactions from "./pages/Transactions";
import Review from "./pages/Review";
import Commitments from "./pages/Commitments";
import Goals from "./pages/Goals";
import Accounts from "./pages/Accounts";
import People from "./pages/People";
import Rules from "./pages/Rules";
import Imports from "./pages/Imports";
import Categories from "./pages/Categories";
import More from "./pages/More";

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/transactions" element={<Transactions />} />
        <Route path="/review" element={<Review />} />
        <Route path="/commitments" element={<Commitments />} />
        <Route path="/goals" element={<Goals />} />
        <Route path="/accounts" element={<Accounts />} />
        <Route path="/people" element={<People />} />
        <Route path="/rules" element={<Rules />} />
        <Route path="/imports" element={<Imports />} />
        <Route path="/categories" element={<Categories />} />
        <Route path="/more" element={<More />} />
      </Route>
    </Routes>
  );
}
