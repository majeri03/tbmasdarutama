"use client";

import { useState } from "react";
import { Plus, Edit2, Trash2, CheckCircle, Calculator } from "lucide-react";

interface Unit {
  id: string;
  name: string;
}

interface ProductUnitForm {
  unitId: string;
  conversionValue: number;
  buyPrice: number;
  sellPrice: number;
  isPrimary: boolean;
}

interface ProductUnitManagerProps {
  units: ProductUnitForm[];
  availableUnits: Unit[];
  onChange: (units: ProductUnitForm[]) => void;
  error?: string;
}

export function ProductUnitManager({
  units,
  availableUnits,
  onChange,
  error,
}: ProductUnitManagerProps) {
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [formData, setFormData] = useState<ProductUnitForm>({
    unitId: "",
    conversionValue: 1,
    buyPrice: 0,
    sellPrice: 0,
    isPrimary: false,
  });

  // Auto-calculate prices based on primary unit
  const [autoCalculate, setAutoCalculate] = useState(true);

  const primaryUnit = units.find((u) => u.isPrimary);

 const handleAdd = () => {
    if (!formData.unitId) {
      return;
    }

    // Check if unit already exists
    if (units.some((u) => u.unitId === formData.unitId)) {
      return;
    }

    // If this is first unit, make it primary
    const isFirstUnit = units.length === 0;
    
    const newUnit: ProductUnitForm = {
      ...formData,
      buyPrice: displayBuyPrice,
      sellPrice: displaySellPrice,
      isPrimary: isFirstUnit ? true : formData.isPrimary,
      conversionValue: isFirstUnit ? 1 : formData.conversionValue,
    };

    onChange([...units, newUnit]);
    resetForm();
  };

  const handleEdit = (index: number) => {
    setEditingIndex(index);
    setFormData(units[index]);
  };

  const handleUpdate = () => {
    if (editingIndex === null) return;

    const updatedUnits = [...units];
    updatedUnits[editingIndex] = {
      ...formData,
      buyPrice: displayBuyPrice,
      sellPrice: displaySellPrice,
    };
    onChange(updatedUnits);
    resetForm();
  };

  const handleDelete = (index: number) => {
    const unitToDelete = units[index];
    
    // Cannot delete if only 1 unit left
    if (units.length === 1) {
      return;
    }

    // If deleting primary unit, make first remaining unit primary
    const remainingUnits = units.filter((_, i) => i !== index);
    if (unitToDelete.isPrimary && remainingUnits.length > 0) {
      remainingUnits[0].isPrimary = true;
      remainingUnits[0].conversionValue = 1;
    }

    onChange(remainingUnits);
  };

  const handleSetPrimary = (index: number) => {
    const updatedUnits = units.map((unit, i) => ({
      ...unit,
      isPrimary: i === index,
      conversionValue: i === index ? 1 : unit.conversionValue,
    }));
    onChange(updatedUnits);
  };

  const resetForm = () => {
    setFormData({
      unitId: "",
      conversionValue: 1,
      buyPrice: 0,
      sellPrice: 0,
      isPrimary: false,
    });
    setEditingIndex(null);
  };

  // Auto-calculate prices based on primary unit
  const getCalculatedPrices = () => {
  if (autoCalculate && primaryUnit && !formData.isPrimary && formData.conversionValue > 0) {
    return {
      buyPrice: primaryUnit.buyPrice * formData.conversionValue,
      sellPrice: primaryUnit.sellPrice * formData.conversionValue,
    };
  }
  return {
    buyPrice: formData.buyPrice,
    sellPrice: formData.sellPrice,
  };
};

const calculatedPrices = getCalculatedPrices();
const displayBuyPrice = autoCalculate && primaryUnit && !formData.isPrimary 
  ? calculatedPrices.buyPrice 
  : formData.buyPrice;
const displaySellPrice = autoCalculate && primaryUnit && !formData.isPrimary 
  ? calculatedPrices.sellPrice 
  : formData.sellPrice;

  const getAvailableUnitsForSelect = () => {
    const usedUnitIds = units
      .filter((_, i) => i !== editingIndex)
      .map((u) => u.unitId);
    return availableUnits.filter((u) => !usedUnitIds.includes(u.id));
  };

  return (
    <div className="space-y-4">
      {/* Unit List */}
      {units.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-semibold text-gray-700 mb-2">
            Daftar Satuan ({units.length})
          </h4>
          {units.map((unit, index) => {
            const unitInfo = availableUnits.find((u) => u.id === unit.unitId);
            return (
              <div
                key={index}
                className={`p-3 rounded-lg border ${
                  unit.isPrimary
                    ? "bg-blue-50 border-blue-200"
                    : "bg-white border-gray-200"
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold text-gray-900">
                        {unitInfo?.name || "Unknown"}
                      </span>
                      {unit.isPrimary && (
                        <span className="px-2 py-0.5 rounded text-xs font-semibold bg-blue-600 text-white">
                          UTAMA
                        </span>
                      )}
                    </div>
                    <div className="grid grid-cols-3 gap-3 text-sm">
                      <div>
                        <p className="text-gray-600 text-xs">Konversi</p>
                        <p className="font-semibold text-gray-900">
                          {unit.conversionValue}
                          {!unit.isPrimary && " × satuan utama"}
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-600 text-xs">Harga Beli</p>
                        <p className="font-semibold text-gray-900">
                          Rp {unit.buyPrice.toLocaleString("id-ID")}
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-600 text-xs">Harga Jual</p>
                        <p className="font-semibold text-green-600">
                          Rp {unit.sellPrice.toLocaleString("id-ID")}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    {!unit.isPrimary && (
                      <button
                        type="button"
                        onClick={() => handleSetPrimary(index)}
                        className="p-2 rounded-lg hover:bg-green-100 transition-colors"
                        title="Jadikan satuan utama"
                      >
                        <CheckCircle className="w-4 h-4 text-green-600" />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleEdit(index)}
                      className="p-2 rounded-lg hover:bg-blue-100 transition-colors"
                      title="Edit"
                    >
                      <Edit2 className="w-4 h-4 text-blue-600" />
                    </button>
                    {units.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleDelete(index)}
                        className="p-2 rounded-lg hover:bg-red-100 transition-colors"
                        title="Hapus"
                      >
                        <Trash2 className="w-4 h-4 text-red-600" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add/Edit Form */}
      <div className="glass-card p-4">
        <h4 className="text-sm font-semibold text-gray-700 mb-3">
          {editingIndex !== null ? "Edit Satuan" : "Tambah Satuan"}
        </h4>

        <div className="space-y-3">
          {/* Unit Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Satuan <span className="text-red-500">*</span>
            </label>
            <select
              value={formData.unitId}
              onChange={(e) =>
                setFormData({ ...formData, unitId: e.target.value })
              }
              className="glass-input"
              disabled={editingIndex !== null}
            >
              <option value="">Pilih Satuan</option>
              {getAvailableUnitsForSelect().map((unit) => (
                <option key={unit.id} value={unit.id}>
                  {unit.name}
                </option>
              ))}
            </select>
          </div>

          {/* Conversion Value */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nilai Konversi <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              min="1"
              value={formData.conversionValue}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  conversionValue: parseInt(e.target.value) || 1,
                })
              }
              disabled={formData.isPrimary || units.length === 0}
              className="glass-input"
              placeholder="1"
            />
            <p className="text-xs text-gray-500 mt-1">
              {formData.isPrimary || units.length === 0
                ? "Satuan utama selalu bernilai 1"
                : "Berapa satuan utama dalam 1 unit ini?"}
            </p>
          </div>

          {/* Auto Calculate Toggle */}
          {primaryUnit && !formData.isPrimary && (
            <div className="flex items-center gap-2 p-2 rounded-lg bg-blue-50 border border-blue-200">
              <input
                type="checkbox"
                id="autoCalculate"
                checked={autoCalculate}
                onChange={(e) => setAutoCalculate(e.target.checked)}
                className="w-4 h-4 text-blue-600 rounded"
              />
              <label
                htmlFor="autoCalculate"
                className="text-sm text-gray-700 cursor-pointer flex items-center gap-1"
              >
                <Calculator className="w-4 h-4 text-blue-600" />
                <span>Hitung harga otomatis</span>
              </label>
            </div>
          )}

          {/* Prices */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Harga Beli <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                min="0"
                value={displayBuyPrice}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    buyPrice: parseFloat(e.target.value) || 0,
                  })
                }
                disabled={autoCalculate && primaryUnit && !formData.isPrimary}
                className="glass-input"
                placeholder="0"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Harga Jual <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                min="0"
                value={displaySellPrice}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    sellPrice: parseFloat(e.target.value) || 0,
                  })
                }
                disabled={autoCalculate && primaryUnit && !formData.isPrimary}
                className="glass-input"
                placeholder="0"
              />
            </div>
          </div>

          {/* Primary Checkbox (only for first unit or when editing) */}
          {(units.length === 0 || (editingIndex !== null && !units[editingIndex].isPrimary)) && (
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="isPrimary"
                checked={formData.isPrimary || units.length === 0}
                onChange={(e) =>
                  setFormData({ ...formData, isPrimary: e.target.checked })
                }
                disabled={units.length === 0}
                className="w-4 h-4 text-blue-600 rounded"
              />
              <label htmlFor="isPrimary" className="text-sm text-gray-700">
                Jadikan satuan utama
              </label>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-2 pt-2">
            {editingIndex !== null ? (
              <>
                <button
                  type="button"
                  onClick={resetForm}
                  className="btn-secondary flex-1"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleUpdate}
                  className="btn-primary flex-1"
                  disabled={!formData.unitId || formData.sellPrice < formData.buyPrice}
                >
                  <CheckCircle className="w-4 h-4" />
                  <span>Update</span>
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={handleAdd}
                className="btn-primary w-full"
                disabled={!formData.unitId || formData.sellPrice < formData.buyPrice}
              >
                <Plus className="w-4 h-4" />
                <span>Tambah Satuan</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">
          {error}
        </p>
      )}

      {/* Help Text */}
      {units.length === 0 && (
        <div className="p-3 rounded-lg bg-blue-50 border border-blue-200">
          <p className="text-sm text-gray-700">
            <span className="font-semibold">💡 Tips:</span> Satuan pertama yang
            Anda tambahkan akan otomatis menjadi satuan utama dengan nilai
            konversi 1.
          </p>
        </div>
      )}
    </div>
  );
}