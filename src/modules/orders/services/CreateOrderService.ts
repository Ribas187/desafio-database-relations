import { inject, injectable } from 'tsyringe';

import AppError from '@shared/errors/AppError';

import IProductsRepository from '@modules/products/repositories/IProductsRepository';
import ICustomersRepository from '@modules/customers/repositories/ICustomersRepository';
import Order from '../infra/typeorm/entities/Order';
import IOrdersRepository from '../repositories/IOrdersRepository';

interface IProduct {
  id: string;
  quantity: number;
}

interface IRequest {
  customer_id: string;
  products: IProduct[];
}

@injectable()
class CreateOrderService {
  constructor(
    @inject('OrdersRepository')
    private ordersRepository: IOrdersRepository,

    @inject('ProductsRepository')
    private productsRepository: IProductsRepository,

    @inject('CustomersRepository')
    private customersRepository: ICustomersRepository,
  ) {}

  public async execute({ customer_id, products }: IRequest): Promise<Order> {
    const customer = await this.customersRepository.findById(customer_id);

    if (!customer) {
      throw new AppError('Customer ID does not exist');
    }

    const productsList = await this.productsRepository.findAllById(products);

    if (productsList.length !== products.length) {
      throw new AppError('Some of the products in order do not exist');
    }

    const orderProducts = productsList.map(product => {
      const orderProduct = products.find(prod => prod.id === product.id);

      if (!orderProduct) {
        throw new AppError('Product error');
      } else if (orderProduct.quantity > product.quantity) {
        throw new AppError('Requested quantity is not available');
      }

      return {
        ...product,
        product_id: product.id,
        quantity: orderProduct.quantity,
      };
    });

    const orderProductsQuantities = productsList.map(product => {
      const orderProduct = products.find(prod => prod.id === product.id);

      if (!orderProduct) {
        throw new AppError('Product error');
      }

      return {
        id: product.id,
        quantity: product.quantity - orderProduct.quantity,
      };
    });

    await this.productsRepository.updateQuantity(orderProductsQuantities);

    const order = await this.ordersRepository.create({
      customer,
      products: orderProducts,
    });

    return order;
  }
}

export default CreateOrderService;
