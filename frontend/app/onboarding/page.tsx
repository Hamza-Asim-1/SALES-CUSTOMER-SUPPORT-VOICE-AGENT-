"use client";

import { useState } from "react";

export default function CompanyPage() {
  const x=1
  const [companyInfo, setCompanyInfo] = useState({
    name: "",
    description: "",
    website: "",
    socialLinks: [""], // Start with one empty social link
    products: [{ name: "", price: "", description: "" }] // Start with one empty product
  });
  const [isLoading, setIsLoading] = useState(false);
  
  // Modified to ensure only one section can be open at a time
  const [activeSection, setActiveSection] = useState<'companyInfo' | 'products' | null>('companyInfo');

  const toggleSection = (section: 'companyInfo' | 'products') => {
    // If the section is already active, close it
    if (activeSection === section) {
      setActiveSection(null);
    } else {
      // Otherwise, open the new section (and close any other)
      setActiveSection(section);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setCompanyInfo((prev) => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSocialLinkChange = (index: number, value: string) => {
    setCompanyInfo((prev) => {
      const updatedLinks = [...prev.socialLinks];
      updatedLinks[index] = value;
      return {
        ...prev,
        socialLinks: updatedLinks
      };
    });
  };

  const addSocialLink = () => {
    setCompanyInfo((prev) => ({
      ...prev,
      socialLinks: [...prev.socialLinks, ""]
    }));
  };

  const removeSocialLink = (index: number) => {
    setCompanyInfo((prev) => {
      const updatedLinks = [...prev.socialLinks];
      updatedLinks.splice(index, 1);
      return {
        ...prev,
        socialLinks: updatedLinks
      };
    });
  };

  const handleProductChange = (index: number, field: string, value: string) => {
    setCompanyInfo((prev) => {
      const updatedProducts = [...prev.products];
      updatedProducts[index] = {
        ...updatedProducts[index],
        [field]: value
      };
      return {
        ...prev,
        products: updatedProducts
      };
    });
  };

  const addProduct = () => {
    setCompanyInfo((prev) => ({
      ...prev,
      products: [...prev.products, { name: "", price: "", description: "" }]
    }));
  };

  const removeProduct = (index: number) => {
    setCompanyInfo((prev) => {
      const updatedProducts = [...prev.products];
      updatedProducts.splice(index, 1);
      return {
        ...prev,
        products: updatedProducts
      };
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      // Replace with your actual API endpoint for saving company information
      const response = await fetch("/api/company", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(companyInfo),
      });

      if (!response.ok) {
        throw new Error("Failed to save company information");
      }

      // Success handling
      console.log("Company information saved successfully");
      // Optionally redirect or clear the form here
    } catch (error) {
      console.error("Error saving company information:", error);
      // Error handling
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 w-full">
      <main className="container mx-auto px-4 py-8 max-w-4xl">
        <h1 className="text-2xl sm:text-3xl font-bold text-center pt-12 mb-8">Onboarding</h1>
        
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Company Info Expandable Section - with transition */}
          <div className="bg-white rounded-2xl shadow-lg overflow-hidden border border-gray-100 backdrop-filter backdrop-blur-sm bg-opacity-80 hover:bg-opacity-100 transition-all duration-300">
            <button 
              type="button"
              onClick={() => toggleSection('companyInfo')}
              className="w-full px-7 py-6 text-left flex justify-between items-center hover:bg-gray-50 transition-colors focus:outline-none"
            >
              <span className="text-base sm:text-lg font-medium flex items-center text-gray-800">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-3 text-blue-600" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M4 4a2 2 0 012-2h8a2 2 0 012 2v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4zm3 1h6v4H7V5zm8 8V7h2v6h-2zM9 5h2v4H9V5zm0 6h2v4H9v-4z" clipRule="evenodd" />
                </svg>
                Company Information
              </span>
              <svg 
                xmlns="http://www.w3.org/2000/svg" 
                className={`h-5 w-5 text-gray-500 transition-transform duration-300 ${activeSection === 'companyInfo' ? 'transform rotate-180' : ''}`} 
                viewBox="0 0 20 20" 
                fill="currentColor"
              >
                <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
            
            {/* Added transition for smooth open/close */}
            <div 
              className={`overflow-hidden transition-all duration-300 ease-in-out ${
                activeSection === 'companyInfo' ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0'
              }`}
            >
              <div className="p-7 border-t border-gray-100 space-y-1">
                <div>
                  <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                    Company Name
                  </label>
                  <input
                    type="text"
                    id="name"
                    name="name"
                    value={companyInfo.name}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
                
                <div>
                  <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
                    Company Description
                  </label>
                  <textarea
                    id="description"
                    name="description"
                    value={companyInfo.description}
                    onChange={handleInputChange}
                    rows={3}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                
                <div>
                  <label htmlFor="website" className="block text-sm font-medium text-gray-700 mb-1">
                    Company Website
                  </label>
                  <input
                    type="url"
                    id="website"
                    name="website"
                    value={companyInfo.website}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="https://example.com"
                  />
                </div>
                
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="block text-sm font-medium text-gray-700">Social Media Links</label>
                    {companyInfo.socialLinks.length > 1 && (
                      <span className="text-xs text-gray-500">{companyInfo.socialLinks.length} links</span>
                    )}
                  </div>
                  
                  <div className="space-y-3">
                    {companyInfo.socialLinks.map((link, index) => (
                      <div key={`social-${index}`} className="flex space-x-2">
                        <input
                          type="url"
                          value={link}
                          onChange={(e) => handleSocialLinkChange(index, e.target.value)}
                          className="flex-1 px-4 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="LinkedIn, Twitter, or other social media URL"
                        />
                        {companyInfo.socialLinks.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeSocialLink(index)}
                            className="text-gray-400 hover:text-red-500 px-2 focus:outline-none"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM7 9a1 1 0 000 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
                            </svg>
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                  
                  <button
                    type="button"
                    onClick={addSocialLink}
                    className="inline-flex items-center px-4 py-2 text-sm text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-xl transition-colors focus:outline-none"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1.5" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clipRule="evenodd" />
                    </svg>
                    Add Link
                  </button>
                </div>
                
                <div className="pt-4 flex justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      toggleSection('companyInfo');
                      toggleSection('products');
                    }}
                    className="inline-flex items-center px-5 py-2.5 text-sm bg-blue-600 text-white rounded-xl hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-md hover:shadow-lg transition-all"
                  >
                    Continue
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 ml-1.5" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          </div>
          
          {/* Products Expandable Section - with transition */}
          <div className="bg-white rounded-2xl shadow-lg overflow-hidden border border-gray-100 backdrop-filter backdrop-blur-sm bg-opacity-80 hover:bg-opacity-100 transition-all duration-300">
            <button 
              type="button"
              onClick={() => toggleSection('products')}
              className="w-full px-7 py-6 text-left flex justify-between items-center hover:bg-gray-50 transition-colors focus:outline-none"
            >
              <span className="text-base sm:text-lg font-medium flex items-center text-gray-800">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-3 text-blue-600" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M11 17a1 1 0 001.447.894l4-2A1 1 0 0017 15V9.236a1 1 0 00-1.447-.894l-4 2a1 1 0 00-.553.894V17zM15.211 6.276a1 1 0 000-1.788l-4.764-2.382a1 1 0 00-.894 0L4.789 4.488a1 1 0 000 1.788l4.764 2.382a1 1 0 00.894 0l4.764-2.382zM4.447 8.342A1 1 0 003 9.236V15a1 1 0 00.553.894l4 2A1 1 0 009 17v-5.764a1 1 0 00-.553-.894l-4-2z" />
                </svg>
                Products
              </span>
              <svg 
                xmlns="http://www.w3.org/2000/svg" 
                className={`h-5 w-5 text-gray-500 transition-transform duration-300 ${activeSection === 'products' ? 'transform rotate-180' : ''}`} 
                viewBox="0 0 20 20" 
                fill="currentColor"
              >
                <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
            
            {/* Added transition for smooth open/close */}
            <div 
              className={`overflow-hidden transition-all duration-300 ease-in-out ${
                activeSection === 'products' ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0'
              }`}
            >
              <div className="p-7 border-t border-gray-100">
                <div className="space-y-6">
                  {companyInfo.products.map((product, index) => (
                    <div key={`product-${index}`} className="bg-gray-50 rounded-xl p-5 border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
                      <div className="flex justify-between items-center mb-4">
                        <h3 className="text-sm font-medium text-gray-700">
                          {index === 0 ? "Product Information" : `Product ${index + 1}`}
                        </h3>
                        {companyInfo.products.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeProduct(index)}
                            className="text-gray-400 hover:text-red-500 focus:outline-none"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM7 9a1 1 0 000 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
                            </svg>
                          </button>
                        )}
                      </div>
                      
                      <div className="space-y-4">
                        {/* Product name and price in same row - Ensured for all screen sizes */}
                        <div className="flex space-x-4">
                          <div className="flex-1">
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Product Name
                            </label>
                            <input
                              type="text"
                              value={product.name}
                              onChange={(e) => handleProductChange(index, "name", e.target.value)}
                              className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                              placeholder="Enter product name"
                            />
                          </div>
                          
                          <div className="w-1/3">
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Price
                            </label>
                            <input
                              type="text"
                              value={product.price}
                              onChange={(e) => handleProductChange(index, "price", e.target.value)}
                              className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                              placeholder="Enter price"
                            />
                          </div>
                        </div>
                        
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Description
                          </label>
                          <textarea
                            value={product.description}
                            onChange={(e) => handleProductChange(index, "description", e.target.value)}
                            rows={2}
                            className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="Describe your product"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                  
                  <button
                    type="button"
                    onClick={addProduct}
                    className="inline-flex items-center px-4 py-2 text-sm text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-xl transition-colors focus:outline-none shadow-sm"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1.5" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clipRule="evenodd" />
                    </svg>
                    Add Product
                  </button>
                </div>
              </div>
            </div>
          </div>
          
          <div className="mt-8 flex justify-end">
            <button
              type="submit"
              disabled={isLoading}
              className={`px-6 py-3.5 bg-blue-600 text-white font-medium rounded-xl hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-lg hover:shadow-xl transition-all ${
                isLoading ? "opacity-70 cursor-not-allowed" : ""
              }`}
            >
              {isLoading ? "Saving..." : "Complete Onboarding"}
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}


// FAKE COMMIT 123


/* Add this to your global CSS file or as a style tag */
{/* 
  .custom-scrollbar::-webkit-scrollbar {
    width: 6px;
  }
  
  .custom-scrollbar::-webkit-scrollbar-track {
    background: #f1f1f1;
    border-radius: 10px;
  }
  
  .custom-scrollbar::-webkit-scrollbar-thumb {
    background: #cbcbcb;
    border-radius: 10px;
  }
  
  .custom-scrollbar::-webkit-scrollbar-thumb:hover {
    background: #a8a8a8;
  }
*/}
