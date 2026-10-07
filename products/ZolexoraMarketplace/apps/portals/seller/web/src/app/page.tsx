"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { motion, useScroll, useTransform } from "framer-motion";
import { 
  BarChart3, 
  Globe, 
  Package, 
  ShieldCheck, 
  Store, 
  TrendingUp, 
  ArrowRight,
  Menu,
  X,
  CheckCircle,
  Percent,
  CreditCard,
  DollarSign
} from "lucide-react";

export default function SellerLandingPage() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  
  const { scrollY } = useScroll();
  const y1 = useTransform(scrollY, [0, 1000], [0, 200]);
  const opacity = useTransform(scrollY, [0, 300], [1, 0]);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const features = [
    {
      icon: <Store className="w-6 h-6" />,
      title: "Multi-Storefront Reach",
      description: "List your products once and sell seamlessly across Zolexora Shop and Mahila Madel to reach diverse customer bases."
    },
    {
      icon: <Package className="w-6 h-6" />,
      title: "Centralized Inventory",
      description: "Manage your entire catalog and inventory from a single, intuitive dashboard. Updates reflect instantly everywhere."
    },
    {
      icon: <BarChart3 className="w-6 h-6" />,
      title: "Unified Analytics",
      description: "Gain deep insights into your business performance with cross-platform sales data, trend analysis, and actionable metrics."
    },
    {
      icon: <Globe className="w-6 h-6" />,
      title: "Global Payments",
      description: "Accept payments from anywhere with our secure, integrated payment orchestration. Get paid fast and reliably."
    }
  ];

  const steps = [
    { num: "01", title: "Create your account", desc: "Sign up in minutes with just your email and business details." },
    { num: "02", title: "List your products", desc: "Upload your catalog with our easy-to-use product management tools." },
    { num: "03", title: "Start selling", desc: "Reach thousands of buyers immediately across our multiple storefronts." }
  ];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 selection:bg-slate-200">
      {/* Navigation */}
      <nav className={`fixed top-0 w-full z-50 transition-all duration-300 ${isScrolled ? "bg-white/80 backdrop-blur-md border-b border-slate-200 py-3" : "bg-transparent py-5"}`}>
        <div className="container mx-auto px-6 md:px-12 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-slate-900 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold font-display text-xl leading-none">Z</span>
            </div>
            <span className="font-display font-bold text-xl tracking-tight">Seller Portal</span>
          </div>
          
          {/* Desktop Nav */}
          <div className="hidden md:flex items-center gap-8 font-medium text-sm">
            <a href="#features" className="text-slate-600 hover:text-slate-900 transition-colors">Features</a>
            <a href="#how-it-works" className="text-slate-600 hover:text-slate-900 transition-colors">How it Works</a>
            <a href="#pricing" className="text-slate-600 hover:text-slate-900 transition-colors">Pricing</a>
            <Link href="/auth" className="text-slate-600 hover:text-slate-900 transition-colors">Log In</Link>
            <Link 
              href="/auth" 
              className="bg-slate-900 text-white px-5 py-2.5 rounded-full hover:bg-slate-800 transition-colors"
            >
              Start Selling
            </Link>
          </div>

          {/* Mobile Menu Toggle */}
          <button 
            className="md:hidden text-slate-900"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? <X /> : <Menu />}
          </button>
        </div>
      </nav>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-40 bg-white pt-24 px-6 flex flex-col gap-6 md:hidden">
          <a href="#features" onClick={() => setMobileMenuOpen(false)} className="text-2xl font-display font-medium text-slate-900">Features</a>
          <a href="#how-it-works" onClick={() => setMobileMenuOpen(false)} className="text-2xl font-display font-medium text-slate-900">How it Works</a>
          <a href="#pricing" onClick={() => setMobileMenuOpen(false)} className="text-2xl font-display font-medium text-slate-900">Pricing</a>
          <div className="h-px bg-slate-100 w-full my-2"></div>
          <Link href="/auth" onClick={() => setMobileMenuOpen(false)} className="text-2xl font-display font-medium text-slate-900">Log In</Link>
          <Link 
            href="/auth" 
            onClick={() => setMobileMenuOpen(false)}
            className="bg-slate-900 text-white px-6 py-4 rounded-xl text-center text-lg font-medium mt-4"
          >
            Start Selling Today
          </Link>
        </div>
      )}

      {/* Hero Section */}
      <section className="relative pt-32 pb-20 md:pt-48 md:pb-32 overflow-hidden">
        {/* Background decorative elements */}
        <div className="absolute top-0 right-0 -translate-y-12 translate-x-1/3 w-[800px] h-[800px] bg-slate-100 rounded-full blur-3xl opacity-50 pointer-events-none"></div>
        <div className="absolute bottom-0 left-0 translate-y-1/3 -translate-x-1/3 w-[600px] h-[600px] bg-slate-200 rounded-full blur-3xl opacity-30 pointer-events-none"></div>
        
        <div className="container mx-auto px-6 md:px-12 relative z-10">
          <div className="max-w-4xl mx-auto text-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: "easeOut" }}
            >
              <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-100 text-slate-700 text-sm font-medium mb-6">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                Join the fastest growing marketplace network
              </span>
            </motion.div>
            
            <motion.h1 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1, ease: "easeOut" }}
              className="font-display text-5xl md:text-7xl font-bold tracking-tight text-slate-900 mb-8 leading-tight"
            >
              Sell everywhere.<br className="hidden md:block" />
              Manage from <span className="text-slate-400">one place.</span>
            </motion.h1>
            
            <motion.p 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2, ease: "easeOut" }}
              className="text-lg md:text-xl text-slate-600 mb-10 max-w-2xl mx-auto leading-relaxed"
            >
              Zolexora Seller Portal gives you the tools to list your products across multiple premium storefronts, manage inventory seamlessly, and scale your business effortlessly.
            </motion.p>
            
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.3, ease: "easeOut" }}
              className="flex flex-col sm:flex-row items-center justify-center gap-4"
            >
              <Link 
                href="/auth" 
                className="w-full sm:w-auto flex items-center justify-center gap-2 bg-slate-900 text-white px-8 py-4 rounded-full text-lg font-medium hover:bg-slate-800 transition-all hover:gap-3 hover:pr-6"
              >
                Start Selling <ArrowRight className="w-5 h-5" />
              </Link>
              <a 
                href="#how-it-works" 
                className="w-full sm:w-auto flex items-center justify-center px-8 py-4 rounded-full text-lg font-medium text-slate-700 hover:bg-slate-100 transition-colors"
              >
                Learn More
              </a>
            </motion.div>
          </div>
        </div>

        {/* Dashboard Mockup - Abstract representation */}
        <motion.div 
          style={{ y: y1, opacity }}
          className="container mx-auto px-6 md:px-12 mt-20 relative z-10 hidden md:block"
        >
          <div className="w-full max-w-5xl mx-auto bg-white rounded-2xl shadow-2xl overflow-hidden border border-slate-100 flex flex-col">
            {/* Window header */}
            <div className="h-12 bg-slate-50 border-b border-slate-100 flex items-center px-4 gap-2">
              <div className="w-3 h-3 rounded-full bg-slate-200"></div>
              <div className="w-3 h-3 rounded-full bg-slate-200"></div>
              <div className="w-3 h-3 rounded-full bg-slate-200"></div>
            </div>
            {/* Window body abstract */}
            <div className="p-8 grid grid-cols-12 gap-6 bg-slate-50 h-[400px]">
              <div className="col-span-3 space-y-4">
                <div className="h-8 bg-slate-200 rounded-md w-3/4"></div>
                <div className="h-4 bg-slate-200 rounded-md w-1/2 mt-8"></div>
                <div className="h-4 bg-slate-200 rounded-md w-2/3"></div>
                <div className="h-4 bg-slate-200 rounded-md w-1/2"></div>
                <div className="h-4 bg-slate-200 rounded-md w-3/4"></div>
              </div>
              <div className="col-span-9 space-y-6">
                <div className="grid grid-cols-3 gap-6">
                  <div className="h-32 bg-white rounded-xl border border-slate-100 shadow-sm p-4 flex flex-col justify-between">
                    <div className="h-4 w-1/3 bg-slate-100 rounded-md"></div>
                    <div className="h-8 w-1/2 bg-slate-200 rounded-md"></div>
                  </div>
                  <div className="h-32 bg-white rounded-xl border border-slate-100 shadow-sm p-4 flex flex-col justify-between">
                    <div className="h-4 w-1/3 bg-slate-100 rounded-md"></div>
                    <div className="h-8 w-1/2 bg-slate-200 rounded-md"></div>
                  </div>
                  <div className="h-32 bg-white rounded-xl border border-slate-100 shadow-sm p-4 flex flex-col justify-between">
                    <div className="h-4 w-1/3 bg-slate-100 rounded-md"></div>
                    <div className="h-8 w-1/2 bg-slate-200 rounded-md"></div>
                  </div>
                </div>
                <div className="h-48 bg-white rounded-xl border border-slate-100 shadow-sm"></div>
              </div>
            </div>
          </div>
        </motion.div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-24 bg-white">
        <div className="container mx-auto px-6 md:px-12">
          <div className="text-center max-w-3xl mx-auto mb-20">
            <h2 className="font-display text-4xl md:text-5xl font-bold text-slate-900 mb-6">Everything you need to thrive</h2>
            <p className="text-lg text-slate-600">Built from the ground up for modern merchants. We provide the infrastructure, so you can focus on building your brand.</p>
          </div>
          
          <div className="grid md:grid-cols-2 gap-x-12 gap-y-16 max-w-5xl mx-auto">
            {features.map((feature, i) => (
              <div key={i} className="flex gap-6 group">
                <div className="flex-shrink-0 w-14 h-14 bg-slate-50 text-slate-900 rounded-xl flex items-center justify-center group-hover:bg-slate-900 group-hover:text-white transition-colors duration-300">
                  {feature.icon}
                </div>
                <div>
                  <h3 className="text-xl font-bold text-slate-900 mb-3">{feature.title}</h3>
                  <p className="text-slate-600 leading-relaxed">{feature.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="py-24 bg-slate-50">
        <div className="container mx-auto px-6 md:px-12">
          <div className="max-w-5xl mx-auto">
            <h2 className="font-display text-4xl font-bold text-slate-900 mb-16 text-center">Start selling in three steps</h2>
            
            <div className="grid md:grid-cols-3 gap-8 relative">
              {/* Connector line */}
              <div className="hidden md:block absolute top-12 left-[15%] right-[15%] h-px bg-slate-200 z-0"></div>
              
              {steps.map((step, i) => (
                <div key={i} className="relative z-10 flex flex-col items-center text-center">
                  <div className="w-24 h-24 bg-white border border-slate-100 shadow-sm rounded-full flex items-center justify-center text-2xl font-display font-bold text-slate-900 mb-6">
                    {step.num}
                  </div>
                  <h3 className="text-xl font-bold text-slate-900 mb-3">{step.title}</h3>
                  <p className="text-slate-600 px-4">{step.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Pricing & Rate Card */}
      <section id="pricing" className="py-24 bg-white border-t border-slate-100">
        <div className="container mx-auto px-6 md:px-12">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="font-display text-4xl font-bold text-slate-900 mb-6">Simple, transparent pricing</h2>
            <p className="text-lg text-slate-600">No hidden fees, no complicated tiers. You only pay when you make a sale. Our rate card is designed to help you grow.</p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
            {/* Zero Monthly Fees */}
            <div className="bg-slate-50 rounded-3xl p-10 border border-slate-100 flex flex-col h-full">
              <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center shadow-sm mb-6 text-slate-900 border border-slate-100">
                <DollarSign className="w-6 h-6" />
              </div>
              <h3 className="text-2xl font-bold text-slate-900 mb-2">$0 Monthly Fee</h3>
              <p className="text-slate-600 mb-8 flex-grow">Set up your store and list your entire catalog across our network completely free of charge.</p>
              <ul className="space-y-4">
                <li className="flex items-start gap-3 text-slate-700">
                  <CheckCircle className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
                  <span>Unlimited product listings</span>
                </li>
                <li className="flex items-start gap-3 text-slate-700">
                  <CheckCircle className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
                  <span>Multi-storefront distribution</span>
                </li>
                <li className="flex items-start gap-3 text-slate-700">
                  <CheckCircle className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
                  <span>Full analytics access</span>
                </li>
              </ul>
            </div>

            {/* Selling Commission */}
            <div className="bg-slate-900 rounded-3xl p-10 border border-slate-800 flex flex-col h-full text-white relative overflow-hidden transform md:-translate-y-4 shadow-xl">
              <div className="absolute top-0 right-0 p-6 opacity-10 pointer-events-none">
                <Percent className="w-32 h-32" />
              </div>
              <div className="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center mb-6 text-white border border-white/20 relative z-10">
                <Percent className="w-6 h-6" />
              </div>
              <h3 className="text-2xl font-bold text-white mb-2 relative z-10">8-15% Commission</h3>
              <p className="text-slate-300 mb-8 flex-grow relative z-10">You only pay when a customer completes a purchase. Rates vary slightly by product category.</p>
              <ul className="space-y-4 relative z-10">
                <li className="flex items-start gap-3 text-slate-200">
                  <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                  <span>Apparel & Fashion: 12%</span>
                </li>
                <li className="flex items-start gap-3 text-slate-200">
                  <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                  <span>Electronics & Tech: 8%</span>
                </li>
                <li className="flex items-start gap-3 text-slate-200">
                  <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                  <span>Home & Lifestyle: 15%</span>
                </li>
              </ul>
            </div>

            {/* Payment Processing */}
            <div className="bg-slate-50 rounded-3xl p-10 border border-slate-100 flex flex-col h-full">
              <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center shadow-sm mb-6 text-slate-900 border border-slate-100">
                <CreditCard className="w-6 h-6" />
              </div>
              <h3 className="text-2xl font-bold text-slate-900 mb-2">Payment Processing</h3>
              <p className="text-slate-600 mb-8 flex-grow">Standard processing fees apply to each transaction, securely managed by our gateway partners.</p>
              <ul className="space-y-4">
                <li className="flex items-start gap-3 text-slate-700">
                  <CheckCircle className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
                  <span>2.9% + $0.30 per transaction</span>
                </li>
                <li className="flex items-start gap-3 text-slate-700">
                  <CheckCircle className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
                  <span>Fraud protection included</span>
                </li>
                <li className="flex items-start gap-3 text-slate-700">
                  <CheckCircle className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
                  <span>Payouts every 3 business days</span>
                </li>
              </ul>
            </div>
          </div>
          
          <div className="mt-16 text-center">
            <p className="text-slate-500 text-sm">Need a custom rate card for enterprise volumes? <a href="#" className="text-slate-900 font-medium underline underline-offset-4">Contact our sales team</a>.</p>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-24 bg-slate-900 text-white">
        <div className="container mx-auto px-6 md:px-12 text-center">
          <div className="grid md:grid-cols-3 gap-12 max-w-4xl mx-auto">
            <div>
              <div className="text-5xl font-display font-bold mb-2">2+</div>
              <div className="text-slate-400">Integrated Storefronts</div>
            </div>
            <div>
              <div className="text-5xl font-display font-bold mb-2">1M+</div>
              <div className="text-slate-400">Active Shoppers</div>
            </div>
            <div>
              <div className="text-5xl font-display font-bold mb-2">$0</div>
              <div className="text-slate-400">Monthly Fees</div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-32 bg-white">
        <div className="container mx-auto px-6 md:px-12">
          <div className="max-w-4xl mx-auto bg-slate-50 rounded-[2.5rem] p-12 md:p-20 text-center border border-slate-100">
            <h2 className="font-display text-4xl md:text-5xl font-bold text-slate-900 mb-6">Ready to scale your business?</h2>
            <p className="text-xl text-slate-600 mb-10 max-w-2xl mx-auto">Join the premium marketplace platform designed for ambitious sellers. Setting up takes less than 5 minutes.</p>
            <Link 
              href="/auth" 
              className="inline-flex items-center gap-2 bg-slate-900 text-white px-10 py-5 rounded-full text-xl font-medium hover:bg-slate-800 transition-all hover:gap-4 hover:pr-8"
            >
              Get Started Now <ArrowRight className="w-6 h-6" />
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 bg-white border-t border-slate-100 text-center">
        <div className="container mx-auto px-6 md:px-12">
          <div className="w-10 h-10 bg-slate-900 rounded-lg flex items-center justify-center mx-auto mb-6">
            <span className="text-white font-bold font-display text-2xl leading-none">Z</span>
          </div>
          <p className="text-slate-500 font-medium mb-2">Zolexora Marketplace Platform</p>
          <p className="text-slate-400 text-sm">© {new Date().getFullYear()} Zolexora. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
